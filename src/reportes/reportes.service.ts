import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateReportFormatDto } from './dto/update-report-format.dto';
import { CreateReportFormatDto } from './dto/create-reporte.dto';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReportFormatDto) {
    return this.prisma.reportFormat.create({ data: dto });
  }

  async findAll() {
    return this.prisma.reportFormat.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id:                     true,
        title:                  true,
        description:            true,
        status:                 true,
        isValidated:            true,
        trazabilidadCode:       true,
        contabilidadCode:       true,
        ageiCode:               true,
        // filtros búsqueda
        hasSearchFilters:       true,
        hasSearchFiltersAll:    true,
        // filtros datos
        hasManagementFilters:   true,
        hasChannelFilters:      true,
        hasDateFilters:         true,
        hasDispatchTypeFilters: true,
        hasRegimenFilters:      true,
        hasStatusFilters:       true,
        // exportación
        hasExcelExport:         true,
        hasPdfExport:           true,
        // meta
        createdAt:              true,
        updatedAt:              true,
      },
    });
  }

  async findOne(id: number) {
    const record = await this.prisma.reportFormat.findFirst({
      where: { id, isActive: true, deletedAt: null },
    });

    if (!record) {
      throw new NotFoundException(`ReportFormat #${id} no encontrado`);
    }

    return record;
  }

  async update(id: number, dto: UpdateReportFormatDto) {
    await this.findOne(id);

    return this.prisma.reportFormat.update({
      where: { id },
      data: { ...dto, updatedAt: new Date() },
    });
  }

  async remove(id: number, updatedBy?: number) {
    await this.findOne(id);

    return this.prisma.reportFormat.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        updatedBy: updatedBy ?? null,
      },
    });
  }
}