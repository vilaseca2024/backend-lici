import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrazabilidadService } from 'src/external-db/trazabilidad.service';
import { Prisma } from '@prisma/client';
import { QueryFotografiaDto } from './dto/query-fotografia.dto';

@Injectable()
export class InternoFotografiaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trazabilidadService: TrazabilidadService,
  ) {}

  async findTrazabilidadFiltrado(query: QueryFotografiaDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;

    // 1. Internos locales filtrados
    const where: Prisma.InternoWhereInput = {
      deletedAt: null,
      active: true,
      ...(query.search && {
        interno: { contains: query.search, mode: 'insensitive' },
      }),
      ...(query.estado && { estado: query.estado }),
    };

    const internos = await this.prisma.interno.findMany({
      where,
      select: {
        id:       true,
        interno:  true,
        cliente:  true,
        estado:   true,
        validado: true,
        paso:     true,
      },
    });

    if (internos.length === 0) {
      return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

    const internoNames = internos.map(i => i.interno);
    const internoMap   = new Map(internos.map(i => [i.interno, i]));

    // 2. Folders donde name = interno
    const folders = await this.prisma.folder.findMany({
      where: {
        name:      { in: internoNames },
        deletedAt: null,
        active:    true,
      },
      select: {
        id:          true,
        name:        true,
        url:         true,
        softwareUrl: true,
        driveUrl:    true,
      },
    });
    const folderMap = new Map(folders.map(f => [f.name, f]));

    // 3. fetchTodos() retorna TramiteRow[] directamente (con caché incluido)
    const trazabilidad = await this.trazabilidadService.fetchTodos();

    // 4. Filtrar solo los que existen en Interno local + enriquecer
    const enriquecidos = trazabilidad
      .filter(t => internoMap.has(t.internoTexto))
      .map(t => ({
        ...t,
        internoLocal: internoMap.get(t.internoTexto) ?? null,
        folderId:     folderMap.get(t.internoTexto)?.id ?? null,
        folder:       folderMap.get(t.internoTexto)     ?? null,
      }));

    // 5. Paginación manual
    const total = enriquecidos.length;
    const data  = enriquecidos.slice((page - 1) * limit, page * limit);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}