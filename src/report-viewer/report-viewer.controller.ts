import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ReportViewerService,
  TableQueryParams,
} from './report-viewer.service';

@Controller('report-viewer')
export class ReportViewerController {
  constructor(private readonly svc: ReportViewerService) {}

  /** Listado público: id, title, description, createdAt, columnCount, hasFilters */
  @Get()
  findAll() {
    return this.svc.findAllPublic();
  }

  /** Opciones para los selects de filtros (gestiones, canales, regimenes, etc.) */
  @Get('filter-options')
  filterOptions() {
    return this.svc.getFilterOptions();
  }

  /**
   * Datos de la tabla con filtros y paginación.
   * Query params disponibles:
   *   page, limit, search, searchType, gestion, canal,
   *   fechaDesde, fechaHasta, tipoDespacho, regimen, estado
   */
  @Get(':id/data')
  tableData(
    @Param('id', ParseIntPipe) id: number,
    @Query('page')          page?:          string,
    @Query('limit')         limit?:         string,
    @Query('search')        search?:        string,
    @Query('searchType')    searchType?:    string,
    @Query('gestion')       gestion?:       string,
    @Query('canal')         canal?:         string,
    @Query('fechaDesde')    fechaDesde?:    string,
    @Query('fechaHasta')    fechaHasta?:    string,
    @Query('tipoDespacho')  tipoDespacho?:  string,
    @Query('regimen')       regimen?:       string,
    @Query('estado')        estado?:        string,
  ) {
    const params: TableQueryParams = {
      page:          page         ? parseInt(page)         : 1,
      limit:         limit        ? parseInt(limit)        : 20,
      search,
      searchType,
      gestion:       gestion      ? parseInt(gestion)      : undefined,
      canal,
      fechaDesde,
      fechaHasta,
      tipoDespacho:  tipoDespacho ? parseInt(tipoDespacho) : undefined,
      regimen:       regimen      ? parseInt(regimen)      : undefined,
      estado:        estado       !== undefined ? parseInt(estado) : undefined,
    };
    return this.svc.getTableData(id, params);
  }
}