import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { EncryptionService } from '../common/encryption.service';
import { ConfigService } from '@nestjs/config';
import { CreateFotoDto } from './dto/create-foto.dto';
import { UpdateFotoDto } from './dto/update-foto.dto';
import { QueryFotoDto } from './dto/query-foto.dto';
import { Prisma } from '@prisma/client';
import { DRIVE_UPLOAD_QUEUE, DRIVE_UPLOAD_JOB } from '../queue/drive-upload.queue';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FotosService {
  private readonly localStorageRoot: string;
  private readonly appBaseUrl: string;

  constructor(
    private readonly prisma:       PrismaService,
    private readonly driveService: GoogleDriveService,
    private readonly encryption:   EncryptionService,
    private readonly config:       ConfigService,
    @InjectQueue(DRIVE_UPLOAD_QUEUE) private readonly driveQueue: Queue,
  ) {
    this.localStorageRoot = this.config.get<string>(
      'LOCAL_STORAGE_PATH',
      path.join(process.cwd(), 'storage'),
    );
    this.appBaseUrl = this.config.get<string>('APP_BASE_URL', 'http://localhost:3000');
  }

  // ── Guardar archivo físico local ──────────────────────────────────────────
  private saveLocalFile(
    file:        Express.Multer.File,
    internoName: string,
  ): {
    relativePath:   string;
    encryptedToken: string;
    fullUrl:        string;
    absolutePath:   string; // necesario para que el worker lea el archivo
  } {
    const ext      = path.extname(file.originalname).toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const relDir   = path.join('IMCRUZ', internoName, 'fotos');
    const absDir   = path.join(this.localStorageRoot, relDir);
    const relPath  = path.join(relDir, fileName);
    const absPath  = path.join(absDir, fileName);

    if (!fs.existsSync(absDir)) {
      fs.mkdirSync(absDir, { recursive: true });
    }

    fs.writeFileSync(absPath, file.buffer);

    const token   = this.encryption.encrypt(relPath);
    const fullUrl = `${this.appBaseUrl}/files/${token}`;

    return { relativePath: relPath, encryptedToken: token, fullUrl, absolutePath: absPath };
  }

  // ── Resolver nombre del interno desde folder ──────────────────────────────
  private async resolveInternoName(folderId?: number, fallback?: string): Promise<string> {
    if (!folderId) return fallback ?? 'sin-interno';

    const folder = await this.prisma.folder.findFirst({
      where:  { id: folderId, deletedAt: null },
      select: { name: true },
    });

    if (!folder) throw new NotFoundException(`Folder #${folderId} no encontrado`);
    return folder.name;
  }

  // ── CREATE — una foto ─────────────────────────────────────────────────────
  // Drive ya no bloquea — el registro se crea al instante y Drive sube en cola
  async create(
    dto:    any,
    userId: number,
    file?:  Express.Multer.File,
  ) {
    if (!dto) throw new BadRequestException('El body no puede estar vacío');

    const internoName = await this.resolveInternoName(dto?.folderId, dto?.name);

    if (file) {
      // 1. Guardar local — sin red, inmediato
      const local = this.saveLocalFile(file, internoName);

      // 2. Crear en BD — driveUrl queda null, el worker lo rellena después
      const foto = await this.prisma.fotos.create({
        data: {
          ...dto,
          userId,
          url:         local.fullUrl,
          softwareUrl: local.encryptedToken,
        },
        include: this.defaultIncludes(),
      });

      // 3. Encolar subida a Drive — responde al cliente sin esperar
      await this.driveQueue.add(DRIVE_UPLOAD_JOB.SINGLE, {
        fotoId:      foto.id,
        filePath:    local.absolutePath,
        fileName:    file.originalname,
        mimeType:    file.mimetype,
        internoName,
      });

      return foto;
    }

    // Sin archivo — solo crea el registro
    return this.prisma.fotos.create({
      data:    { ...dto, userId },
      include: this.defaultIncludes(),
    });
  }

  // ── CREATE BULK — múltiples fotos ─────────────────────────────────────────
  // Flujo completo: local → BD → cola. Drive queda 100% en background.
  async createBulk(
    dto:    CreateFotoDto,
    userId: number,
    files:  Express.Multer.File[],
  ) {
    const internoName = await this.resolveInternoName(dto.folderId, dto.name);

    // ── PASO 1 + 2: Guardar local y crear en BD para cada archivo ────────────
    // Todo sin Drive — el usuario ve la respuesta en ~200ms sin importar
    // cuántos archivos sean
    const results = await Promise.allSettled(
      files.map(async (file, i) => {
        const local = this.saveLocalFile(file, internoName);

        const foto = await this.prisma.fotos.create({
          data: {
            ...dto,
            name:        `${dto.name} ${i + 1}`,
            userId,
            url:         local.fullUrl,
            softwareUrl: local.encryptedToken,
            // driveUrl: null — se rellena cuando el worker procese el job
          },
          include: this.defaultIncludes(),
        });

        // ── PASO 3: Encolar cada archivo individualmente ──────────────────────
        // BullMQ respeta la concurrencia configurada en QueueModule (máx 3)
        // y reintenta 3 veces con backoff si falla
        await this.driveQueue.add(
          DRIVE_UPLOAD_JOB.SINGLE,
          {
            fotoId:      foto.id,
            filePath:    local.absolutePath,
            fileName:    file.originalname,
            mimeType:    file.mimetype,
            internoName,
          },
          {
            priority: 10, // prioridad baja — cede paso a subidas individuales
          },
        );

        return foto;
      }),
    );

    const saved  = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<any>).value);

    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      data:    saved,
      total:   saved.length,
      failed,
      message: 'Archivos guardados. Sincronización con Drive en proceso.',
    };
  }

  // ── FIND ALL ──────────────────────────────────────────────────────────────
  async findAll(query: QueryFotoDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 10;
    const { search, status, type, folderId, solicitudId, active } = query;
    const skip  = (page - 1) * limit;

    const where: Prisma.FotosWhereInput = {
      deletedAt: null,
      ...(active      !== undefined && { active }),
      ...(status      && { status }),
      ...(type        && { type }),
      ...(folderId    && { folderId }),
      ...(solicitudId && { solicitudId }),
      ...(search && {
        OR: [
          { name:    { contains: search, mode: 'insensitive' } },
          { city:    { contains: search, mode: 'insensitive' } },
          { comment: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.fotos.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        include: this.defaultIncludes(),
      }),
      this.prisma.fotos.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── FIND ONE ──────────────────────────────────────────────────────────────
  async findOne(id: number) {
    const foto = await this.prisma.fotos.findFirst({
      where:   { id, deletedAt: null },
      include: this.defaultIncludes(),
    });
    if (!foto) throw new NotFoundException(`Foto #${id} no encontrada`);
    return foto;
  }

  // ── FIND BY REFERENCE ─────────────────────────────────────────────────────
  async findByReference(reference: string) {
    const fotos = await this.prisma.fotos.findMany({
      where: {
        reference,
        deletedAt: null,
        active:    true,
      },
      select: {
        id:          true,
        softwareUrl: true,
        comment:     true,
        name:        true,
        createdAt:   true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data:  fotos,
      total: fotos.length,
    };
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  async update(id: number, dto: UpdateFotoDto, userId: number) {
    await this.findOne(id);
    return this.prisma.fotos.update({
      where:   { id },
      data:    { ...dto, updatedBy: userId },
      include: this.defaultIncludes(),
    });
  }

  // ── SOFT DELETE ───────────────────────────────────────────────────────────
  async remove(id: number, userId: number) {
    await this.findOne(id);
    return this.prisma.fotos.update({
      where: { id },
      data:  { deletedAt: new Date(), active: false, updatedBy: userId },
    });
  }

  // ── RESTORE ───────────────────────────────────────────────────────────────
  async restore(id: number, userId: number) {
    const foto = await this.prisma.fotos.findFirst({ where: { id } });
    if (!foto) throw new NotFoundException(`Foto #${id} no encontrada`);
    return this.prisma.fotos.update({
      where: { id },
      data:  { deletedAt: null, active: true, updatedBy: userId },
    });
  }

  // ── Includes por defecto ──────────────────────────────────────────────────
  private defaultIncludes() {
    return {
      user:      { select: { id: true, nombre: true, email: true } },
      folder:    { select: { id: true, name: true } },
      solicitud: { select: { id: true } },
    };
  }
}