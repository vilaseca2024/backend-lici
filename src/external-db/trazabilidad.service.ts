import { Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { ExternalDbService } from './external-db.service';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TramiteRow {
  id: number;
  internoTexto: string;
  paso: number | null;
  regimen: number | null;
  liquidador_id: number | null;
  revisor_tributos_id: number | null;
  gestor_id: number | null;
  cliente_id: number | null;

  gestortxt: string | null;
  revisortxt: string | null;
  liquidadortxt: string | null;
  regimentxt: string | null;
  pasotxt: string | null;

  [key: string]: unknown;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
const INTERNO_REGEX = /^\d{4}-\d{2}$/;

// ── Servicio ──────────────────────────────────────────────────────────────────

@Injectable()
export class TrazabilidadService {
  private readonly logger = new Logger(TrazabilidadService.name);

  /** null = sin filtro (todos los clientes) */
  private readonly clienteIds: number[] | null;

  constructor(
    private readonly extDb: ExternalDbService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly config: ConfigService,
  ) {
    this.clienteIds = this.parseClienteId(
      this.config.get<string>('CLIENTE_ID') ?? '',
    );

    if (this.clienteIds === null) {
      this.logger.warn('CLIENTE_ID vacío — se devolverán trámites de TODOS los clientes');
    } else {
      this.logger.log(`TrazabilidadService iniciado para cliente_id=${JSON.stringify(this.clienteIds)}`);
    }
  }

  // ── Parser de CLIENTE_ID ──────────────────────────────────────────────────────

  /**
   * '' o no definido → null  (sin filtro)
   * '64'            → [64]
   * '[4,5,33]'      → [4, 5, 33]
   */
  private parseClienteId(raw: string): number[] | null {
    const trimmed = raw.trim();

    // Vacío → sin filtro
    if (!trimmed) return null;

    // Array estilo JSON: [4,5,33]
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed) || parsed.some((v) => isNaN(Number(v)))) {
        throw new Error(`CLIENTE_ID inválido: '${raw}' — formato esperado: [4,5,33]`);
      }
      return (parsed as number[]).map(Number);
    }

    // Número simple: 64
    const single = parseInt(trimmed, 10);
    if (isNaN(single)) {
      throw new Error(`CLIENTE_ID inválido: '${raw}' — debe ser un número, lista [4,5,33] o vacío`);
    }
    return [single];
  }

  // ── WHERE clause dinámica ─────────────────────────────────────────────────────

  /**
   * Retorna { clause, params } listo para inyectar en el SQL.
   *
   * Sin filtro   → clause = ''            params = []
   * 1 cliente    → clause = 'A.cliente_id = ?'         params = [64]
   * N clientes   → clause = 'A.cliente_id IN (?,?,?)'  params = [4,5,33]
   */
  private buildClienteClause(hasWhereAlready: boolean): { clause: string; params: number[] } {
    if (this.clienteIds === null) {
      return { clause: '', params: [] };
    }

    const connector = hasWhereAlready ? 'AND' : 'WHERE';

    if (this.clienteIds.length === 1) {
      return {
        clause: `${connector} A.cliente_id = ?`,
        params: this.clienteIds,
      };
    }

    const placeholders = this.clienteIds.map(() => '?').join(', ');
    return {
      clause: `${connector} A.cliente_id IN (${placeholders})`,
      params: this.clienteIds,
    };
  }

  // ── Cache key helper ──────────────────────────────────────────────────────────

  private get clienteCacheTag(): string {
    if (this.clienteIds === null) return 'all';
    return this.clienteIds.join('-');
  }

  // ── Validación ───────────────────────────────────────────────────────────────

  private validarInterno(interno: string): boolean {
    return INTERNO_REGEX.test(interno);
  }

  // ── fetchTrazabilidadCompleta ─────────────────────────────────────────────────

  async fetchTrazabilidadCompleta(interno: string): Promise<TramiteRow[]> {
    if (!this.validarInterno(interno)) {
      this.logger.warn(
        `fetchTrazabilidadCompleta: formato inválido '${interno}' — se esperaba 0000-00`,
      );
      return [];
    }

    const cacheKey = `trazabilidad_${this.clienteCacheTag}_${interno}`;
    const cached = await this.cache.get<TramiteRow[]>(cacheKey);
    if (cached) {
      this.logger.log(`Cache HIT para '${interno}' (cliente ${this.clienteCacheTag})`);
      return cached;
    }

    const { clause, params } = this.buildClienteClause(true); // ya tiene WHERE

    const sql = `
      SELECT
        UG.name  AS gestortxt,
        UR.name  AS revisortxt,
        UL.name  AS liquidadortxt,
        R.regimen AS regimentxt,
        D.paso   AS pasotxt,
        A.*
      FROM aduana_tramites A
      LEFT JOIN users UL ON A.liquidador_id       = UL.id
      LEFT JOIN users UR ON A.revisor_tributos_id  = UR.id
      LEFT JOIN users UG ON A.gestor_id            = UG.id
      LEFT JOIN aduana_regimenes R ON A.regimen    = R.id
      LEFT JOIN aduana_pasos     D ON D.orden      = A.paso
      WHERE A.internoTexto = ?
      ${clause}
      GROUP BY A.id
    `;

    try {
      const rows = await this.extDb.query<TramiteRow>(sql, [interno, ...params]);

      this.logger.log(
        `fetchTrazabilidadCompleta('${interno}', cliente=${this.clienteCacheTag}) → ${rows.length} filas`,
      );

      if (rows.length > 0) {
        await this.cache.set(cacheKey, rows, CACHE_TTL_MS);
      }

      return rows;
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`fetchTrazabilidadCompleta('${interno}') falló: ${error.message}`);
      return [];
    }
  }

  // ── fetchTodos ────────────────────────────────────────────────────────────────

  async fetchTodos(): Promise<TramiteRow[]> {
    const cacheKey = `trazabilidad_todos_${this.clienteCacheTag}`;
    const cached = await this.cache.get<TramiteRow[]>(cacheKey);
    if (cached) {
      this.logger.log(`Cache HIT para todos los trámites (cliente ${this.clienteCacheTag})`);
      return cached;
    }

    const { clause, params } = this.buildClienteClause(false); // sin WHERE previo

    const sql = `
      SELECT
        UG.name  AS gestortxt,
        UR.name  AS revisortxt,
        UL.name  AS liquidadortxt,
        R.regimen AS regimentxt,
        D.paso   AS pasotxt,
        A.*
      FROM aduana_tramites A
      LEFT JOIN users UL ON A.liquidador_id       = UL.id
      LEFT JOIN users UR ON A.revisor_tributos_id  = UR.id
      LEFT JOIN users UG ON A.gestor_id            = UG.id
      LEFT JOIN aduana_regimenes R ON A.regimen    = R.id
      LEFT JOIN aduana_pasos     D ON D.orden      = A.paso
      ${clause}
      GROUP BY A.id
    `;

    try {
      const rows = await this.extDb.query<TramiteRow>(sql, params);
      this.logger.log(`fetchTodos(cliente=${this.clienteCacheTag}) → ${rows.length} filas`);
      if (rows.length > 0) {
        await this.cache.set(cacheKey, rows, CACHE_TTL_MS);
      }
      return rows;
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`fetchTodos() falló: ${error.message}`);
      return [];
    }
  }

  // ── Invalidar caché ───────────────────────────────────────────────────────────

  async invalidarCacheTodos(): Promise<void> {
    await this.cache.del(`trazabilidad_todos_${this.clienteCacheTag}`);
    this.logger.log(`Cache invalidado para todos los trámites (cliente ${this.clienteCacheTag})`);
  }

  async invalidarCache(interno: string): Promise<void> {
    await this.cache.del(`trazabilidad_${this.clienteCacheTag}_${interno}`);
    this.logger.log(`Cache invalidado para '${interno}' (cliente ${this.clienteCacheTag})`);
  }
}