import { Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
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

  // Campos JOIN (nombres del SELECT)
  gestortxt: string | null;
  revisortxt: string | null;
  liquidadortxt: string | null;
  regimentxt: string | null;
  pasotxt: string | null;

  // Resto de columnas de aduana_tramites (A.*)
  [key: string]: unknown;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos en ms (NestJS cache-manager v5 usa ms)
const INTERNO_REGEX = /^\d{4}-\d{2}$/;

// ── Servicio ──────────────────────────────────────────────────────────────────

@Injectable()
export class TrazabilidadService {
  private readonly logger = new Logger(TrazabilidadService.name);

  constructor(
    private readonly extDb: ExternalDbService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // ── Validación ───────────────────────────────────────────────────────────────

  private validarInterno(interno: string): boolean {
    return INTERNO_REGEX.test(interno);
  }

  // ── Query principal ──────────────────────────────────────────────────────────

  async fetchTrazabilidadCompleta(interno: string): Promise<TramiteRow[]> {
    // 1. Validar formato (igual que Python: '0001-25')
    if (!this.validarInterno(interno)) {
      this.logger.warn(
        `fetchTrazabilidadCompleta: formato inválido '${interno}' — se esperaba 0000-00`,
      );
      return [];
    }

    // 2. Intentar desde caché
    const cacheKey = `trazabilidad_${interno}`;
    const cached = await this.cache.get<TramiteRow[]>(cacheKey);
    if (cached) {
      this.logger.log(`Cache HIT para '${interno}'`);
      return cached;
    }

    // 3. Query a la base de datos externa (replica exacta del SQL Python)
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
      GROUP BY A.id
    `;

    try {
      const rows = await this.extDb.query<TramiteRow>(sql, [interno]);

      this.logger.log(
        `fetchTrazabilidadCompleta('${interno}') → ${rows.length} filas`,
      );

      // 4. Guardar en caché solo si hay resultados
      if (rows.length > 0) {
        await this.cache.set(cacheKey, rows, CACHE_TTL_MS);
        this.logger.log(
          `Cache SET para '${interno}' — ${rows.length} filas por ${CACHE_TTL_MS / 1000}s`,
        );
      }

      return rows;
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `fetchTrazabilidadCompleta('${interno}') falló: ${error.message}`,
      );
      return [];
    }
  }


  async fetchTodos(): Promise<TramiteRow[]> {
    const cacheKey = `trazabilidad_todos`;
    const cached = await this.cache.get<TramiteRow[]>(cacheKey);
    if (cached) {
      this.logger.log(`Cache HIT para todos los trámites`);
      return cached;
    }

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
      GROUP BY A.id
       

    `;

    try {
      const rows = await this.extDb.query<TramiteRow>(sql);
      this.logger.log(`fetchTodos() → ${rows.length} filas`);
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

  async invalidarCacheTodos(): Promise<void> {
    await this.cache.del(`trazabilidad_todos`);
    this.logger.log(`Cache invalidado para todos los trámites`);
  }

  // ── Invalidar caché manualmente (útil para testing/admin) ────────────────────

  async invalidarCache(interno: string): Promise<void> {
    await this.cache.del(`trazabilidad_${interno}`);
    this.logger.log(`Cache invalidado para '${interno}'`);
  }
}