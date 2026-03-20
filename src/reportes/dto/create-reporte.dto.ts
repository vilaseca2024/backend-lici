import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateReportFormatDto {
  // ── Info general ──────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  userId: number;

  // ── Columnas seleccionadas por fuente ─────────────────────────────────────
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  trazabilidadCode?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  contabilidadCode?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ageiCode?: string[];

  // ── Campos disponibles ────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  availableFields?: string;

  // ── Filtros de búsqueda ───────────────────────────────────────────────────
  @IsBoolean()
  @IsOptional()
  hasSearchFilters?: boolean;      // buscador completo

  @IsBoolean()
  @IsOptional()
  hasSearchFiltersAll?: boolean;   // buscador DIM/DEX · Pedido · Factura

  // ── Filtros de datos ──────────────────────────────────────────────────────
  @IsBoolean()
  @IsOptional()
  hasManagementFilters?: boolean;  // filtro gestiones

  @IsBoolean()
  @IsOptional()
  hasChannelFilters?: boolean;     // filtro canal

  @IsBoolean()
  @IsOptional()
  hasDateFilters?: boolean;        // filtro rango de fechas

  @IsBoolean()
  @IsOptional()
  hasDispatchTypeFilters?: boolean; // filtro tipo de despacho

  @IsBoolean()
  @IsOptional()
  hasRegimenFilters?: boolean;      // filtro tipo de régimen

  @IsBoolean()
  @IsOptional()
  hasStatusFilters?: boolean;       // filtro estado de trámite

  // ── Exportación ───────────────────────────────────────────────────────────
  @IsBoolean()
  @IsOptional()
  hasExcelExport?: boolean;         // exportar Excel

  @IsBoolean()
  @IsOptional()
  hasPdfExport?: boolean;           // exportar PDF

  // ── Estado del formato ────────────────────────────────────────────────────
  @IsBoolean()
  @IsOptional()
  isValidated?: boolean;

  @IsString()
  @IsOptional()
  status?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}