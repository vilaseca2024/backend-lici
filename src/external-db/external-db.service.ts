import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';
import * as ssh2 from 'ssh2';
import * as net from 'net';

@Injectable()
export class ExternalDbService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ExternalDbService.name);

  private sshClient: ssh2.Client | null = null;
  private pool: mysql.Pool | null = null;
  private localPort: number | null = null;
  private proxyServer: net.Server | null = null;

  // Mutex simple para evitar reconexiones simultáneas
  private connecting = false;
  private connectPromise: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {}

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async onModuleInit() {
    await this.ensureConnected();
  }

  async onApplicationShutdown() {
    await this.shutdown();
  }

  // ── Conexión ─────────────────────────────────────────────────────────────────

  async ensureConnected(): Promise<void> {
    // Si ya está todo activo, salir
    if (this.pool && this.sshClient) return;

    // Si ya hay una conexión en curso, esperar
    if (this.connecting && this.connectPromise) {
      return this.connectPromise;
    }

    this.connecting = true;
    this.connectPromise = this._connect().finally(() => {
      this.connecting = false;
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  private _connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.log('Iniciando túnel SSH...');

      const client = new ssh2.Client();

      client.on('ready', () => {
        this.logger.log('SSH conectado — creando servidor proxy TCP local...');

        // Elegir un puerto local libre dinámicamente
        const server = net.createServer((localSocket) => {
          client.forwardOut(
            '127.0.0.1',
            0,
            '127.0.0.1',  // remote_bind_address del túnel
            3306,
            (err, stream) => {
              if (err) {
                this.logger.error(`forwardOut error: ${err.message}`);
                localSocket.destroy();
                return;
              }
              // Pipe bidireccional: socket local ↔ stream SSH
              localSocket.pipe(stream);
              stream.pipe(localSocket);

              stream.on('close', () => localSocket.destroy());
              localSocket.on('close', () => stream.destroy());
              localSocket.on('error', () => stream.destroy());
              stream.on('error', () => localSocket.destroy());
            },
          );
        });

        server.listen(0, '127.0.0.1', async () => {
          const address = server.address() as net.AddressInfo;
          this.localPort = address.port;
          this.proxyServer = server;
          this.sshClient = client;

          this.logger.log(`Proxy TCP activo en puerto local: ${this.localPort}`);

          try {
            this.pool = await this._createPool(this.localPort);
            this.logger.log('Pool MySQL creado correctamente');
            resolve();
          } catch (e) {
            reject(e);
          }
        });

        server.on('error', (err) => {
          this.logger.error(`Proxy server error: ${err.message}`);
          reject(err);
        });
      });

      client.on('error', (err) => {
        this.logger.error(`SSH error: ${err.message}`);
        this.sshClient = null;
        this.pool = null;
        reject(err);
      });

      client.on('close', () => {
        this.logger.warn('Conexión SSH cerrada — se reconectará en la próxima query');
        this.sshClient = null;
        this.pool = null;
        this.proxyServer?.close();
        this.proxyServer = null;
        this.localPort = null;
      });

      // Conectar al servidor SSH
      client.connect({
        host: this.config.get<string>('SSH_HOST'),
        port: this.config.get<number>('SSH_PORT') ?? 7822,
        username: this.config.get<string>('SSH_USER'),
        password: this.config.get<string>('SSH_PASSWORD'),
        // Si usas clave privada en lugar de password:
        // privateKey: fs.readFileSync(this.config.get('SSH_KEY_PATH')),
        keepaliveInterval: 30000,  // 30s — equivalente al set_keepalive=30 de Python
      });
    });
  }

  private async _createPool(port: number): Promise<mysql.Pool> {
    this.logger.log(`Creando pool MySQL → 127.0.0.1:${port}`);

    const pool = mysql.createPool({
      host: '127.0.0.1',
      port,
      user: this.config.get<string>('DB_EXT_USER'),
      password: this.config.get<string>('DB_EXT_PASSWORD'),
      database: this.config.get<string>('DB_EXT_NAME'),
      connectionLimit: 10,       // maxconnections=10
      waitForConnections: true,  // blocking=True
      queueLimit: 0,
      connectTimeout: 10_000,
      timezone: 'Z',
    });

    // Verificar que la conexión funciona realmente
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();

    return pool;
  }

  // ── API pública ──────────────────────────────────────────────────────────────

  /**
   * Ejecuta un SELECT de solo lectura en la base de datos externa.
   * Reconecta automáticamente si el túnel se cayó.
   */
  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    // Reconectar si es necesario
    await this.ensureConnected();

    try {
    const [rows] = await this.pool!.execute<mysql.RowDataPacket[]>(sql, params as any);      return rows as T[];
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`Query falló: ${error.message}`);

      // Invalidar la conexión para forzar reconexión en el próximo intento
      this.sshClient = null;
      this.pool = null;

      throw error;
    }
  }

  // ── Shutdown ─────────────────────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    this.logger.log('Cerrando conexiones externas...');
    await this.pool?.end().catch(() => {});
    this.proxyServer?.close();
    this.sshClient?.end();
    this.pool = null;
    this.sshClient = null;
    this.proxyServer = null;
    this.logger.log('Túnel SSH y pool cerrados');
  }
}