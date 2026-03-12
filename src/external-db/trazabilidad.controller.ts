import {
  Controller,
  Get,
  Param,
  BadRequestException,
  NotFoundException,
  Delete,
} from '@nestjs/common';
import { TrazabilidadService, TramiteRow } from './trazabilidad.service';

@Controller('trazabilidad')
export class TrazabilidadController {
  constructor(private readonly trazabilidadService: TrazabilidadService) {}

  /**
   * GET /trazabilidad/:interno
   * Ejemplo: GET /trazabilidad/0001-25
   */
  @Get(':interno')
  async getTrazabilidad(
    @Param('interno') interno: string,
  ): Promise<{ interno: string; total: number; data: TramiteRow[] }> {
    if (!interno) {
      throw new BadRequestException('El parámetro interno es requerido');
    }

    const data = await this.trazabilidadService.fetchTrazabilidadCompleta(interno);

    if (data.length === 0) {
      throw new NotFoundException(
        `No se encontraron trámites para el interno '${interno}'`,
      );
    }

    return {
      interno,
      total: data.length,
      data,
    };
  }

  /**
   * DELETE /trazabilidad/:interno/cache
   * Invalida el caché de un interno específico
   */
  @Delete(':interno/cache')
  async invalidarCache(
    @Param('interno') interno: string,
  ): Promise<{ message: string }> {
    await this.trazabilidadService.invalidarCache(interno);
    return { message: `Caché invalidado para '${interno}'` };
  }
}