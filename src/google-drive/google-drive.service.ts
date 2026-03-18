import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3, Auth } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GoogleDriveService implements OnModuleInit {
  private drive: drive_v3.Drive;
  private oAuth2Client: Auth.OAuth2Client;
  private readonly logger = new Logger(GoogleDriveService.name);
  private readonly TOKEN_PATH = path.join(process.cwd(), 'credentials', 'token.json');

  // ── Configuración de reintentos ───────────────────────────────────────────
  private readonly MAX_RETRIES   = 3;
  private readonly RETRY_DELAY   = 2000; // ms — se multiplica por el intento (backoff)

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeDrive();
  }

  // ── Inicialización ────────────────────────────────────────────────────────
  private async initializeDrive() {
    try {
      const clientId     = this.configService.get<string>('GOOGLE_CLIENT_ID');
      const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
      const redirectUri  = this.configService.get<string>('GOOGLE_REDIRECT_URI');

      this.oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

      if (!fs.existsSync(this.TOKEN_PATH)) {
        this.logger.warn('⚠️  No se encontró credentials/token.json — ejecuta: npx ts-node generate-token.ts');
        return;
      }

      const token = JSON.parse(fs.readFileSync(this.TOKEN_PATH, 'utf-8'));
      this.oAuth2Client.setCredentials(token);

      // Auto-refresh: cuando el access_token expire se renueva solo y guarda el nuevo
      this.oAuth2Client.on('tokens', (tokens) => {
        const current = JSON.parse(fs.readFileSync(this.TOKEN_PATH, 'utf-8'));
        fs.writeFileSync(
          this.TOKEN_PATH,
          JSON.stringify({ ...current, ...tokens }, null, 2),
        );
        this.logger.log('🔄 Token de Google Drive renovado automáticamente');
      });

      this.drive = google.drive({ version: 'v3', auth: this.oAuth2Client });
      this.logger.log('✅ Google Drive autenticado correctamente');
    } catch (error) {
      this.logger.error(`Error inicializando Google Drive: ${error.message}`);
    }
  }

  // ── Carpetas ──────────────────────────────────────────────────────────────
  async getOrCreateFolder(name: string, parentId?: string): Promise<string> {
    try {
      let query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
      if (parentId) query += ` and '${parentId}' in parents`;

      const res = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      const files = res.data.files ?? [];

      if (files.length > 0) {
        this.logger.log(`📁 Carpeta existente: "${name}" → ${files[0].id}`);
        return files[0].id!;
      }

      const created = await this.drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          ...(parentId && { parents: [parentId] }),
        },
        fields: 'id',
      });

      this.logger.log(`📁 Carpeta creada: "${name}" → ${created.data.id}`);
      return created.data.id!;
    } catch (error) {
      this.logger.error(`Error en carpeta "${name}": ${error.message}`);
      throw new InternalServerErrorException(
        `No se pudo crear la carpeta en Google Drive: ${error.message}`,
      );
    }
  }

  // ── Subida con reintentos (público para uso externo si se necesita) ────────
  async uploadFile({
    name,
    mimeType,
    buffer,
    folderId,
  }: {
    name:     string;
    mimeType: string;
    buffer:   Buffer;
    folderId: string;
  }): Promise<string> {
    return this.uploadWithRetry({ name, mimeType, buffer, folderId });
  }

  // ── Lógica interna de reintento con backoff exponencial ───────────────────
  private async uploadWithRetry(
    params: { name: string; mimeType: string; buffer: Buffer; folderId: string },
    attempt = 1,
  ): Promise<string> {
    try {
      const { Readable } = await import('stream');
      const stream = Readable.from(params.buffer);

      const res = await this.drive.files.create({
        requestBody: {
          name:    params.name,
          mimeType: params.mimeType,
          parents: [params.folderId],
        },
        media: {
          mimeType: params.mimeType,
          body:     stream,
        },
        fields: 'id',
      });

      await this.drive.permissions.create({
        fileId:      res.data.id!,
        requestBody: { role: 'reader', type: 'anyone' },
      });

      this.logger.log(`📄 Archivo subido: "${params.name}" → ${res.data.id}`);
      return res.data.id!;
    } catch (error) {
      const isRetryable =
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ETIMEDOUT')  ||
        error.message?.includes('socket hang up') ||
        error.code === 'ECONNRESET';

      if (isRetryable && attempt < this.MAX_RETRIES) {
        const delay = this.RETRY_DELAY * attempt; // 2s → 4s → 6s
        this.logger.warn(
          `⚠️  Reintento ${attempt}/${this.MAX_RETRIES} para "${params.name}" en ${delay}ms`,
        );
        await new Promise(r => setTimeout(r, delay));
        return this.uploadWithRetry(params, attempt + 1);
      }

      this.logger.error(`❌ Error subiendo archivo "${params.name}": ${error.message}`);
      throw new InternalServerErrorException(
        `No se pudo subir el archivo a Google Drive: ${error.message}`,
      );
    }
  }

  // ── Helpers de URL ────────────────────────────────────────────────────────
  getFolderUrl(folderId: string): string {
    return `https://drive.google.com/drive/folders/${folderId}`;
  }

  getFileUrl(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }
}