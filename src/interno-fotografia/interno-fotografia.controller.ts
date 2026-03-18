import { Controller, Get, Query } from '@nestjs/common';
import { InternoFotografiaService } from './interno-fotografia.service';
import { QueryFotografiaDto } from './dto/query-fotografia.dto';

@Controller('interno-fotografia')
export class InternoFotografiaController {
  constructor(private readonly service: InternoFotografiaService) {}

  @Get()
  findAll(@Query() query: QueryFotografiaDto) {
    return this.service.findTrazabilidadFiltrado(query);
  }
}