import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InternoService } from './interno.service';
import { CreateInternoDto } from './dto/create-interno.dto';
import { UpdateInternoDto } from './dto/update-interno.dto';
import { FilterInternoDto } from './dto/filter-interno.dto';
@Controller('internos')
export class InternoController {
  constructor(private readonly internoService: InternoService) {}

  /**
   * POST /internos
   * Crea un nuevo interno
   */
  @Post()
  create(@Body() createInternoDto: CreateInternoDto) {
    return this.internoService.create(createInternoDto);
  }

  /**
   * GET /internos
   * Lista todos los internos con filtros y paginación
   */
  @Get()
  findAll(@Query() filterDto: FilterInternoDto) {
    return this.internoService.findAll(filterDto);
  }

  /**
   * GET /internos/:id
   * Obtiene un interno por id
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.internoService.findOne(id);
  }

  /**
   * PATCH /internos/:id
   * Actualiza un interno por id
   */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInternoDto: UpdateInternoDto,
  ) {
    return this.internoService.update(id, updateInternoDto);
  }

  /**
   * DELETE /internos/:id
   * Soft delete de un interno
   */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.internoService.remove(id);
  }

  /**
   * PATCH /internos/:id/restore
   * Restaura un interno eliminado (soft delete)
   */
  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.internoService.restore(id);
  }
}