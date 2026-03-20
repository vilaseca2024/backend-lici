import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExternalDbService } from '../external-db/external-db.service';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface FilterOptions {
  gestiones:  { id: number;  label: string }[];
  canales:    { id: string;  label: string }[];
  regimenes:  { id: number;  label: string }[];
  despachos:  { id: number;  label: string }[];
  pasos:      { id: number;  label: string }[];
}

export interface ReportListItem {
  id:          number;
  title:       string | null;
  description: string | null;
  createdAt:   Date;
  columnCount: number;
  hasFilters:  boolean;
}

export interface TableQueryParams {
  page?:      number;
  limit?:     number;
  search?:    string;       // buscador completo o DIM/DEX
  searchType?: string;      // 'dam' | 'pedido' | 'factura'
  gestion?:   number;
  canal?:     string;
  fechaDesde?: string;
  fechaHasta?: string;
  tipoDespacho?: number;
  regimen?:   number;
  estado?:    number;
}

export interface TableResult {
  data:    Record<string, unknown>[];
  total:   number;
  page:    number;
  limit:   number;
  pages:   number;
  columns: { key: string; label: string }[];
}

// ── Diccionario de labels para columnas ───────────────────────────────────────
// Igual al column-labels.constant.ts que generamos antes, resumido aquí para
// no depender de otro archivo. Agrega más si lo necesitas.

const COLUMN_LABELS: Record<string, string> = {
  id:                    'ID',
  cliente_id:            'Cliente',
  gestion_id:            'Gestión',
  region_id:             'Región',
  liquidador_id:         'Liquidador',
  revisor_tributos_id:   'Revisor Tributos',
  gestor_id:             'Gestor',
  liquidador_extra:      'Liquidador Extra',
  tipo:                  'Tipo',
  interno:               'Interno',
  internoTexto:          'Interno Texto',
  paso:                  'Paso',
  estado:                'Estado',
  extra:                 'Extra',
  a2_fAceptacion:        'Fecha Aceptación',
  a9_plazo:              'Plazo',
  proveedor:             'Proveedor',
  pedido:                'Pedido',
  factura:               'Factura',
  fechaFactura:          'Fecha Factura',
  descripcion:           'Descripción',
  observaciones:         'Observaciones',
  observaciones_ob:      'Observaciones (Observado)',
  tipoDespacho:          'Tipo Despacho',
  regimen:               'Régimen',
  urgencia:              'Urgencia',
  DAM:                   'DAM',
  fechaDAM:              'Fecha DAM',
  canalColor:            'Canal Color',
  a1_numeroDeclaracion:  'Número Declaración',
  a3_numeroReferencia:   'Número Referencia',
  a4_aduanaDespacho:     'Aduana Despacho',
  g5_totalTributos:      'Total Tributos',
  b1_razonSocial:        'Razón Social',
  f6_totalValorFOB:      'Total Valor FOB',
  f10_totalValorCIFAduana: 'Total Valor CIF Aduana',
  g1_tributosDeterminadosGA:   'Tributos GA',
  g2_tributosDeterminadosIVA:  'Tributos IVA',
  g3_tributosDeterminadosICED: 'Tributos ICED',
  g4_tributosDeterminadosICE:  'Tributos ICE',
  g5_tributosDeterminadosIEHD: 'Tributos IEHD',
  created_at:  'Creado',
  updated_at:  'Actualizado',
}

function colLabel(key: string): string {
  return COLUMN_LABELS[key] ?? key
}

// ── Servicio ──────────────────────────────────────────────────────────────────

@Injectable()
export class ReportViewerService {
  private readonly logger = new Logger(ReportViewerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly extDb: ExternalDbService,
  ) {}

  // ── Listado público ───────────────────────────────────────────────────────

  async findAllPublic(): Promise<ReportListItem[]> {
    const records = await this.prisma.reportFormat.findMany({
      where:   { isActive: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id:                 true,
        title:              true,
        description:        true,
        createdAt:          true,
        trazabilidadCode:   true,
        contabilidadCode:   true,
        ageiCode:           true,
        hasSearchFilters:       true,
        hasSearchFiltersAll:    true,
        hasManagementFilters:   true,
        hasChannelFilters:      true,
        hasDateFilters:         true,
        hasDispatchTypeFilters: true,
        hasRegimenFilters:      true,
        hasStatusFilters:       true,
      },
    });

    return records.map(r => ({
      id:          r.id,
      title:       r.title,
      description: r.description,
      createdAt:   r.createdAt,
      columnCount: r.trazabilidadCode.length + r.contabilidadCode.length + r.ageiCode.length,
      hasFilters:  r.hasSearchFilters || r.hasSearchFiltersAll || r.hasManagementFilters ||
                   r.hasChannelFilters || r.hasDateFilters || r.hasDispatchTypeFilters ||
                   r.hasRegimenFilters || r.hasStatusFilters,
    }));
  }

  // ── Opciones de filtros (viene de BD externa) ─────────────────────────────

  async getFilterOptions(): Promise<FilterOptions> {
    const [gestiones, canales, regimenes, despachos, pasos] = await Promise.all([
      this.extDb.query<{ id: number; gestion: number }>(
        'SELECT id, gestion FROM aduana_gestiones ORDER BY gestion DESC', []
      ),
      this.extDb.query<{ canal: string; color: string }>(
        'SELECT canal, color FROM aduana_canales ORDER BY id', []
      ),
      this.extDb.query<{ id: number; regimen: string }>(
        'SELECT id, regimen FROM aduana_regimenes ORDER BY id', []
      ),
      this.extDb.query<{ id: number; despacho: string }>(
        'SELECT id, despacho FROM aduana_despachos ORDER BY id', []
      ),
      this.extDb.query<{ id: number; paso: string }>(
        'SELECT id, paso FROM aduana_pasos ORDER BY orden', []
      ),
    ]);

    return {
      gestiones: gestiones.map(g => ({ id: g.id,    label: String(g.gestion) })),
      canales:   canales.map(c =>   ({ id: c.canal,  label: c.color })),
      regimenes: regimenes.map(r => ({ id: r.id,     label: r.regimen })),
      despachos: despachos.map(d => ({ id: d.id,     label: d.despacho })),
      pasos:     pasos.map(p =>     ({ id: p.id,     label: p.paso })),
    };
  }

  // ── Datos de la tabla con filtros y paginación ────────────────────────────

  async getTableData(reportId: number, params: TableQueryParams): Promise<TableResult> {
    // 1. Cargar la configuración del reporte desde Prisma
    const report = await this.prisma.reportFormat.findFirst({
      where: { id: reportId, isActive: true, deletedAt: null },
    });

    if (!report) throw new NotFoundException(`ReportFormat #${reportId} no encontrado`);

    // 2. Determinar columnas a mostrar (por ahora solo trazabilidadCode)
    const columns = report.trazabilidadCode.length > 0
      ? report.trazabilidadCode
      : ['id', 'internoTexto', 'paso', 'estado']; // fallback mínimo

    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    // 3. Construir SELECT con JOINs para las columnas relacionales
    //    Solo se agrega el JOIN si la columna está en la lista seleccionada
    const needsGestor    = columns.includes('gestor_id');
    const needsLiquidador = columns.includes('liquidador_id');
    const needsRevisor   = columns.includes('revisor_tributos_id');
    const needsRegimen   = columns.includes('regimen');
    const needsPaso      = columns.includes('paso');
    const needsCliente   = columns.includes('cliente_id');
    const needsRegion    = columns.includes('region_id');
    const needsTipo      = columns.includes('tipo');
    const needsCanal     = columns.includes('canalColor');

    // Construye la lista de SELECT
    const selectParts: string[] = columns.map(col => {
      switch (col) {
        case 'gestor_id':           return 'UG.name AS gestor_id';
        case 'liquidador_id':       return 'UL.name AS liquidador_id';
        case 'revisor_tributos_id': return 'UR.name AS revisor_tributos_id';
        case 'regimen':             return 'REG.regimen AS regimen';
        case 'paso':                return 'PA.paso AS paso';
        case 'cliente_id':          return 'ENT.entidad AS cliente_id';
        case 'region_id':           return 'RG.region AS region_id';
        case 'tipo':                return 'DESP.despacho AS tipo';
        case 'canalColor':          return 'CAN.color AS canalColor';
        default:                    return `A.${col}`;
      }
    });

    // 4. Construir WHERE dinámico
    const whereParts: string[] = [];
    const whereParams: unknown[] = [];

    // Filtro de cliente (heredado del sistema)
    // Si necesitas filtrar por cliente como en TrazabilidadService, agrégalo aquí

    // Buscador completo
    if (report.hasSearchFilters && params.search) {
      whereParts.push('(A.internoTexto LIKE ? OR A.proveedor LIKE ? OR A.descripcion LIKE ?)');
      const like = `%${params.search}%`;
      whereParams.push(like, like, like);
    }

    // Buscador DIM/DEX / Pedido / Factura
    if (report.hasSearchFiltersAll && params.search && params.searchType) {
      const colMap: Record<string, string> = {
        dam:     'A.DAM',
        pedido:  'A.pedido',
        factura: 'A.factura',
      };
      const col = colMap[params.searchType] ?? 'A.DAM';
      whereParts.push(`${col} LIKE ?`);
      whereParams.push(`%${params.search}%`);
    }

    // Filtro gestiones
    if (report.hasManagementFilters && params.gestion) {
      whereParts.push('A.gestion_id = ?');
      whereParams.push(params.gestion);
    }

    // Filtro canal
    if (report.hasChannelFilters && params.canal) {
      whereParts.push('A.canalColor = ?');
      whereParams.push(params.canal);
    }

    // Filtro rango de fechas
    if (report.hasDateFilters && params.fechaDesde) {
      whereParts.push('A.created_at >= ?');
      whereParams.push(params.fechaDesde);
    }
    if (report.hasDateFilters && params.fechaHasta) {
      whereParts.push('A.created_at <= ?');
      whereParams.push(`${params.fechaHasta} 23:59:59`);
    }

    // Filtro tipo de despacho
    if (report.hasDispatchTypeFilters && params.tipoDespacho) {
      whereParts.push('A.tipoDespacho = ?');
      whereParams.push(params.tipoDespacho);
    }

    // Filtro régimen
    if (report.hasRegimenFilters && params.regimen) {
      whereParts.push('A.regimen = ?');
      whereParams.push(params.regimen);
    }

    // Filtro estado
    if (report.hasStatusFilters && params.estado !== undefined) {
      whereParts.push('A.estado = ?');
      whereParams.push(params.estado);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    // 5. Construir JOINs solo cuando se necesitan
    const joins: string[] = [];
    if (needsLiquidador)  joins.push('LEFT JOIN users UL  ON A.liquidador_id       = UL.id');
    if (needsRevisor)     joins.push('LEFT JOIN users UR  ON A.revisor_tributos_id  = UR.id');
    if (needsGestor)      joins.push('LEFT JOIN users UG  ON A.gestor_id            = UG.id');
    if (needsRegimen)     joins.push('LEFT JOIN aduana_regimenes REG ON A.regimen   = REG.id');
    if (needsPaso)        joins.push('LEFT JOIN aduana_pasos PA      ON A.paso      = PA.id');
    if (needsCliente)     joins.push('LEFT JOIN sis_entidades ENT    ON A.cliente_id = ENT.idEntidad');
    if (needsRegion)      joins.push('LEFT JOIN sis_regiones RG      ON A.region_id  = RG.idRegion');
    if (needsTipo)        joins.push('LEFT JOIN aduana_despachos DESP ON A.tipo      = DESP.id');
    if (needsCanal)       joins.push('LEFT JOIN aduana_canales CAN    ON A.canalColor = CAN.canal');

    const joinClause = joins.join('\n      ');

    // 6. Query de conteo
    const countSql = `
      SELECT COUNT(*) AS total
      FROM aduana_tramites A
      ${joinClause}
      ${whereClause}
    `;
    const countResult = await this.extDb.query<{ total: number }>(countSql, whereParams);
    const total = Number(countResult[0]?.total ?? 0);

    // 7. Query de datos
    const dataSql = `
      SELECT ${selectParts.join(', ')}
      FROM aduana_tramites A
      ${joinClause}
      ${whereClause}
      ORDER BY A.id DESC
      LIMIT ? OFFSET ?
    `;
    const data = await this.extDb.query<Record<string, unknown>>(
      dataSql,
      [...whereParams, limit, offset],
    );

    this.logger.log(`getTableData(report=${reportId}) → ${data.length}/${total} filas`);

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      columns: columns.map(k => ({ key: k, label: colLabel(k) })),
    };
  }
}