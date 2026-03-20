import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { UpdateReportFormatDto } from './dto/update-report-format.dto';
import { ReportesService } from './reportes.service';
import { CreateReportFormatDto } from './dto/create-reporte.dto';

@Controller('report-formats')
export class ReportesController {
  constructor(private readonly reportFormatsService: ReportesService) {}

  @Post()
  create(@Body() dto: CreateReportFormatDto) {
    return this.reportFormatsService.create(dto);
  }

  @Get()
  findAll() {
    return this.reportFormatsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reportFormatsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReportFormatDto,
  ) {
    return this.reportFormatsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.reportFormatsService.remove(id);
  }
}