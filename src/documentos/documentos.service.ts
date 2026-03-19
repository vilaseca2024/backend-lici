import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService }      from '../prisma/prisma.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { EncryptionService }  from '../common/encryption.service';
import { ConfigService }      from '@nestjs/config';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';
import { QueryDocumentoDto }  from './dto/query-documento.dto';
import { Prisma }             from '@prisma/client';
import { DRIVE_UPLOAD_QUEUE, DRIVE_UPLOAD_JOB } from '../queue/drive-upload.queue';
import * as fs   from 'fs';
import * as path from 'path';
import { resolveStoragePath } from '../common/resolve-storage-path';

@Injectable()
export class DocumentosService {
  private readonly localStorageRoot: string;
  private readonly appBaseUrl:       string;

  constructor(
    private readonly prisma:       PrismaService,
    private readonly driveService: GoogleDriveService,
    private readonly encryption:   EncryptionService,
    private readonly config:       ConfigService,
    @InjectQueue(DRIVE_UPLOAD_QUEUE) private readonly driveQueue: Queue,
  ) {
    this.localStorageRoot = resolveStoragePath(this.config.get<string>('LOCAL_STORAGE_PATH'));
    this.appBaseUrl = this.config.get<string>('APP_BASE_URL', 'http://localhost:3000');
  }

  // ── Guardar archivo físico local ──────────────────────────────────────────
  // Sanitizar nombre para disco (sin tildes, n~, espacios)
  private sanitizeFileName(originalName: string): string {
    const ext  = path.extname(originalName).toLowerCase();
    const base = path.basename(originalName, path.extname(originalName));
    const s    = base
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[ñÑ]/g, 'n')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_').replace(/^_|_$/, '').toLowerCase();
    return `${s || 'archivo'}${ext}`;
  }

  // Resolver nombre del INTERNO (folder raiz) desde cualquier folder
  // Si el folder recibido tiene parentId, sube al padre para obtener el nombre del interno.
  // Esto evita que al pasar el subfolder "Fotos" el internoName quede como "Fotos".
  private async resolveInternoName(folderId?: number, fallback?: string): Promise<string> {
    if (!folderId) return fallback ?? 'sin-interno';

    const folder = await this.prisma.folder.findFirst({
      where:  { id: folderId, deletedAt: null },
      select: { id: true, name: true, parentId: true },
    });

    if (!folder) throw new NotFoundException(`Folder #${folderId} no encontrado`);

    // Si tiene padre, subir un nivel para obtener el nombre del interno
    if (folder.parentId) {
      const parent = await this.prisma.folder.findFirst({
        where:  { id: folder.parentId, deletedAt: null },
        select: { name: true, parentId: true },
      });
      // Si el padre tambien tiene padre (estamos muy profundo), usar el padre directo
      if (parent) return parent.name;
    }

    return folder.name;
  }

  // Helper para resolver la jerarquía real si existe un subfolder
  private async resolveFolderTarget(folderId?: number, fallbackName?: string) {
    const internoName = await this.resolveInternoName(folderId, fallbackName);
    let relativeDir = path.join('IMCRUZ', internoName, 'documentos');
    let driveFolderId: string | null = null;

    if (folderId) {
      const folder = await this.prisma.folder.findFirst({ where: { id: folderId } });
      if (folder) {
        if (folder.url) {
          try {
            const dec = this.encryption.decrypt(folder.url);
            if (!dec.startsWith('subfolder-')) relativeDir = dec;
          } catch(e) { }
        }
        if (folder.driveUrl) {
          const match = folder.driveUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
          if (match) driveFolderId = match[1];
        }
      }
    }
    return { internoName, relativeDir, driveFolderId };
  }

  // ── Includes por defecto ──────────────────────────────────────────────────
  private defaultIncludes() {
    return {
      user:      { select: { id: true, nombre: true, email: true } },
      folder:    { select: { id: true, name: true } },
      solicitud: { select: { id: true } },
    };
  }

  // ── CREATE — un documento ─────────────────────────────────────────────────
  async create(
    dto:    CreateDocumentoDto,
    userId: number,
    file?:  Express.Multer.File,
  ) {
    if (!dto) throw new BadRequestException('El body no puede estar vacío');

    const target = await this.resolveFolderTarget(dto.folderId, dto.name);

    if (file) {
      const safeName = this.sanitizeFileName(file.originalname);
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;
      const absDir   = path.join(this.localStorageRoot, target.relativeDir);
      const relPath  = path.join(target.relativeDir, fileName);
      const absPath  = path.join(absDir, fileName);

      if (!fs.existsSync(absDir)) {
        fs.mkdirSync(absDir, { recursive: true });
      }
      fs.writeFileSync(absPath, file.buffer);

      const token   = this.encryption.encrypt(relPath);
      const fullUrl = `${this.appBaseUrl}/files/${token}`;

      const record = await this.prisma.file.create({
        data: {
          ...dto,
          userId,
          url:         fullUrl,
          softwareUrl: token,
        },
        include: this.defaultIncludes(),
      });

      await this.driveQueue.add(DRIVE_UPLOAD_JOB.SINGLE, {
        fileId:        record.id,
        filePath:      absPath,
        fileName:      file.originalname,
        mimeType:      file.mimetype,
        internoName:   target.internoName,
        entity:        'file',
        driveFolderId: target.driveFolderId || undefined,
      });

      return record;
    }

    // Sin archivo — solo crea el registro de metadatos
    return this.prisma.file.create({
      data:    { ...dto, userId },
      include: this.defaultIncludes(),
    });
  }

  // ── CREATE BULK — múltiples documentos ───────────────────────────────────
  async createBulk(
    dto:    CreateDocumentoDto,
    userId: number,
    files:  Express.Multer.File[],
  ) {
    const target = await this.resolveFolderTarget(dto.folderId, dto.name);

    const results = await Promise.allSettled(
      files.map(async (file, i) => {
        const safeName = this.sanitizeFileName(file.originalname);
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;
        const absDir   = path.join(this.localStorageRoot, target.relativeDir);
        const relPath  = path.join(target.relativeDir, fileName);
        const absPath  = path.join(absDir, fileName);

        if (!fs.existsSync(absDir)) {
          fs.mkdirSync(absDir, { recursive: true });
        }
        fs.writeFileSync(absPath, file.buffer);

        const token   = this.encryption.encrypt(relPath);
        const fullUrl = `${this.appBaseUrl}/files/${token}`;

        const record = await this.prisma.file.create({
          data: {
            ...dto,
            name:        `${dto.name} ${i + 1}`,
            userId,
            url:         fullUrl,
            softwareUrl: token,
          },
          include: this.defaultIncludes(),
        });

        await this.driveQueue.add(
          DRIVE_UPLOAD_JOB.SINGLE,
          {
            fileId:        record.id,
            filePath:      absPath,
            fileName:      file.originalname,
            mimeType:      file.mimetype,
            internoName:   target.internoName,
            entity:        'file',
            driveFolderId: target.driveFolderId || undefined,
          },
          { priority: 10 },
        );

        return record;
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
      message: 'Documentos guardados. Sincronización con Drive en proceso.',
    };
  }

  // ── FIND ALL ──────────────────────────────────────────────────────────────
  async findAll(query: QueryDocumentoDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 10;
    const { search, status, type, folderId, solicitudId, active } = query;
    const skip  = (page - 1) * limit;

    const where: Prisma.FileWhereInput = {
      deletedAt: null,
      ...(active      !== undefined && { active }),
      ...(status      && { status }),
      ...(type        && { type }),
      ...(folderId    && { folderId }),
      ...(solicitudId && { solicitudId }),
      ...(search && {
        OR: [
          { name:      { contains: search, mode: 'insensitive' } },
          { city:      { contains: search, mode: 'insensitive' } },
          { comment:   { contains: search, mode: 'insensitive' } },
          { reference: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.file.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        include: this.defaultIncludes(),
      }),
      this.prisma.file.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── FIND ONE ──────────────────────────────────────────────────────────────
  async findOne(id: number) {
    const record = await this.prisma.file.findFirst({
      where:   { id, deletedAt: null },
      include: this.defaultIncludes(),
    });
    if (!record) throw new NotFoundException(`Documento #${id} no encontrado`);
    return record;
  }

  // ── FIND BY REFERENCE ─────────────────────────────────────────────────────
  async findByReference(reference: string) {
    const records = await this.prisma.file.findMany({
      where: { reference, deletedAt: null, active: true },
      select: {
        id:          true,
        softwareUrl: true,
        comment:     true,
        name:        true,
        type:        true,
        createdAt:   true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: records, total: records.length };
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  async update(id: number, dto: UpdateDocumentoDto, userId: number) {
    await this.findOne(id);
    return this.prisma.file.update({
      where:   { id },
      data:    { ...dto, updatedBy: userId },
      include: this.defaultIncludes(),
    });
  }

  // ── SOFT DELETE ───────────────────────────────────────────────────────────
  async remove(id: number, userId: number) {
    await this.findOne(id);
    return this.prisma.file.update({
      where: { id },
      data:  { deletedAt: new Date(), active: false, updatedBy: userId },
    });
  }

  // ── RESTORE ───────────────────────────────────────────────────────────────
  async restore(id: number, userId: number) {
    const record = await this.prisma.file.findFirst({ where: { id } });
    if (!record) throw new NotFoundException(`Documento #${id} no encontrado`);
    return this.prisma.file.update({
      where: { id },
      data:  { deletedAt: null, active: true, updatedBy: userId },
    });
  }
}