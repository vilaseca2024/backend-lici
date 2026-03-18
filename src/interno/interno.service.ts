import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInternoDto } from './dto/create-interno.dto';
import { UpdateInternoDto } from './dto/update-interno.dto';
import { FilterInternoDto } from './dto/filter-interno.dto';
import { FolderService } from '../folder/folder.service';
import { Prisma } from '@prisma/client';
import { QueryInternoConFolderDto } from './dto/query-interno-con-folder.dto';

type FolderResult = Awaited<ReturnType<FolderService['createFromInterno']>>;

@Injectable()
export class InternoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly folderService: FolderService,
  ) {}

  async create(createInternoDto: CreateInternoDto) {
    const { interno, userId, cliente, ...rest } = createInternoDto;

    // ─── 1. Verificar que el usuario existe ──────────────────────────────────
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException(`No existe un usuario con id "${userId}"`);
    }

    // ─── 2. Verificar duplicado de interno ───────────────────────────────────
    const exists = await this.prisma.interno.findUnique({ where: { interno } });
    if (exists) {
      throw new BadRequestException(`Ya existe un interno con el valor "${interno}"`);
    }

    // ─── 3. Crear el registro en BD ──────────────────────────────────────────
    const nuevoInterno = await this.prisma.interno.create({
      data: { interno, userId, cliente, ...rest },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    // ─── 4. Crear carpetas (Drive + local) ───────────────────────────────────
    let folderResult: FolderResult | null = null;
    try {
      folderResult = await this.folderService.createFromInterno({
        internoName: interno,
        cliente,
        userId,
      });
    } catch (error) {
      console.error(`[InternoService] Error creando carpetas: ${error.message}`);
    }

    return {
      interno: nuevoInterno,
      folder: folderResult?.folder ?? null,
      // Exponer la URL segura local y la de Drive al cliente
      urls: folderResult
        ? {
            local: folderResult.secureLocalUrl ?? null,
            drive: folderResult.driveUrl ?? null,
          }
        : null,
    };
  }

  async findAll(filterDto: FilterInternoDto) {
    const {
      page = 1,
      limit = 10,
      interno,
      cliente,
      estado,
      validado,
      active,
      userId,
    } = filterDto;

    const skip = (page - 1) * limit;

    const where: Prisma.InternoWhereInput = {
      deletedAt: null,
      ...(interno && { interno: { contains: interno, mode: 'insensitive' } }),
      ...(cliente && { cliente: { contains: cliente, mode: 'insensitive' } }),
      ...(estado && { estado }),
      ...(validado !== undefined && { validado }),
      ...(active !== undefined && { active }),
      ...(userId && { userId }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.interno.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true } },
        },
      }),
      this.prisma.interno.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const interno = await this.prisma.interno.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    if (!interno) {
      throw new NotFoundException(`Interno con id ${id} no encontrado`);
    }

    return interno;
  }

  async update(id: number, updateInternoDto: UpdateInternoDto) {
    await this.findOne(id);

    const { interno, ...rest } = updateInternoDto;

    if (interno) {
      const exists = await this.prisma.interno.findFirst({
        where: { interno, NOT: { id } },
      });
      if (exists) {
        throw new BadRequestException(`Ya existe un interno con el valor "${interno}"`);
      }
    }

    return this.prisma.interno.update({
      where: { id },
      data: {
        ...(interno && { interno }),
        ...rest,
        updatedAt: new Date(),
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });
  }

  async remove(id: number, deletedBy?: number) {
    await this.findOne(id);

    return this.prisma.interno.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        active: false,
        ...(deletedBy && { updatedBy: deletedBy }),
      },
    });
  }

  async restore(id: number) {
    const interno = await this.prisma.interno.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!interno) {
      throw new NotFoundException(
        `Interno con id ${id} no encontrado o no está eliminado`,
      );
    }

    return this.prisma.interno.update({
      where: { id },
      data: { deletedAt: null, active: true },
    });
  }

  async findConFolder(query: QueryInternoConFolderDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;
    const skip  = (page - 1) * limit;

    const where: Prisma.InternoWhereInput = {
      deletedAt: null,
      active: true,
      ...(query.search && {
        interno: { contains: query.search, mode: 'insensitive' },
      }),
      ...(query.estado    && { estado: query.estado }),
      ...(query.validado !== undefined && { validado: query.validado }),
    };

    const [internos, total] = await this.prisma.$transaction([
      this.prisma.interno.findMany({
        where,
        skip,
        take: limit,
        orderBy: { interno: 'asc' },
        select: {
          id:       true,
          interno:  true,
          cliente:  true,
          estado:   true,
          validado: true,
          paso:     true,
        },
      }),
      this.prisma.interno.count({ where }),
    ]);

    // Un solo query para todos los folders — evita N+1
    const folders = await this.prisma.folder.findMany({
      where: {
        name:      { in: internos.map(i => i.interno) },
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

    return {
      data: internos.map(i => ({
        ...i,
        folderId: folderMap.get(i.interno)?.id   ?? null,
        folder:   folderMap.get(i.interno)        ?? null,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}