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
import { CreateFotoDto }      from './dto/create-foto.dto';
import { UpdateFotoDto }      from './dto/update-foto.dto';
import { QueryFotoDto }       from './dto/query-foto.dto';
import { Prisma }             from '@prisma/client';
import { DRIVE_UPLOAD_QUEUE, DRIVE_UPLOAD_JOB } from '../queue/drive-upload.queue';
import * as fs   from 'fs';
import * as path from 'path';
import { resolveStoragePath } from '../common/resolve-storage-path';

@Injectable()
export class FotosService {
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

  // ── Sanitizar nombre de archivo para disco ────────────────────────────────
  // El nombre en BD (dto.name / file.originalname) se guarda tal cual.
  // Solo el nombre físico en disco queda limpio (sin tildes, espacios, ñ).
  private sanitizeFileName(originalName: string): string {
    const ext  = path.extname(originalName).toLowerCase();
    const base = path.basename(originalName, path.extname(originalName));

    const sanitized = base
      .normalize('NFD')                    // descompone: á → a + ́
      .replace(/[\u0300-\u036f]/g, '')     // elimina diacríticos
      .replace(/ñ/gi, 'n')                 // ñ → n
      .replace(/[^a-zA-Z0-9._-]/g, '_')   // resto → _
      .replace(/_+/g, '_')                 // colapsa múltiples _
      .replace(/^_|_$/g, '')              // quita _ al inicio/fin
      .toLowerCase();

    return `${sanitized || 'archivo'}${ext}`;
  }

  // ── Guardar archivo físico local ──────────────────────────────────────────
  private saveLocalFile(
    file:        Express.Multer.File,
    internoName: string,
  ): {
    relativePath:   string;
    encryptedToken: string;
    fullUrl:        string;
    absolutePath:   string;
  } {
    // Nombre en disco: timestamp + random + nombre sanitizado
    const safeName = this.sanitizeFileName(file.originalname);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;

    const relDir  = path.join('IMCRUZ', internoName, 'fotos');
    const absDir  = path.join(this.localStorageRoot, relDir);
    const relPath = path.join(relDir, fileName);
    const absPath = path.join(absDir, fileName);

    if (!fs.existsSync(absDir)) {
      fs.mkdirSync(absDir, { recursive: true });
    }

    fs.writeFileSync(absPath, file.buffer);

    const token   = this.encryption.encrypt(relPath);
    const fullUrl = `${this.appBaseUrl}/files/${token}`;

    return { relativePath: relPath, encryptedToken: token, fullUrl, absolutePath: absPath };
  }

  // ── Resolver el folder del interno ───────────────────────────────────────
  private async resolveInternoFolder(
    folderId?: number,
  ): Promise<{ id: number; name: string } | null> {
    if (!folderId) return null;
    const folder = await this.prisma.folder.findFirst({
      where:  { id: folderId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!folder) throw new NotFoundException(`Folder #${folderId} no encontrado`);
    return folder;
  }

  // ── Obtener o crear el subfolder "Fotos" ─────────────────────────────────
  private async getOrCreateFotosFolder(
    internoFolderId: number,
    internoName:     string,
    userId:          number,
  ): Promise<number> {
    const existing = await this.prisma.folder.findFirst({
      where:  { name: 'Fotos', parentId: internoFolderId, deletedAt: null },
      select: { id: true },
    });
    if (existing) return existing.id;

    const relDir = path.join('IMCRUZ', internoName, 'fotos');
    const absDir = path.join(this.localStorageRoot, relDir);
    if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });

    const token   = this.encryption.encrypt(relDir);
    const created = await this.prisma.folder.create({
      data:   { name: 'Fotos', parentId: internoFolderId, url: token, userId },
      select: { id: true },
    });
    return created.id;
  }

  // ── CREATE — una foto ─────────────────────────────────────────────────────
  async create(dto: any, userId: number, file?: Express.Multer.File) {
    if (!dto) throw new BadRequestException('El body no puede estar vacío');

    const internoFolder = await this.resolveInternoFolder(dto?.folderId);
    const internoName   = internoFolder?.name ?? dto?.name ?? 'sin-interno';

    let fotosFolderId: number | undefined = undefined;
    if (internoFolder) {
      fotosFolderId = await this.getOrCreateFotosFolder(internoFolder.id, internoName, userId);
    }

    if (file) {
      const local = this.saveLocalFile(file, internoName);

      const foto = await this.prisma.fotos.create({
        data: {
          ...dto,
          userId,
          folderId:    fotosFolderId,
          url:         local.fullUrl,
          softwareUrl: local.encryptedToken,
          // name en BD: se guarda dto.name tal cual (con tildes, ñ, etc.)
        },
        include: this.defaultIncludes(),
      });

      await this.driveQueue.add(DRIVE_UPLOAD_JOB.SINGLE, {
        fotoId:      foto.id,
        filePath:    local.absolutePath,
        fileName:    file.originalname,   // Drive recibe el nombre original
        mimeType:    file.mimetype,
        internoName,
      });

      return foto;
    }

    return this.prisma.fotos.create({
      data:    { ...dto, userId, folderId: fotosFolderId },
      include: this.defaultIncludes(),
    });
  }

  // ── CREATE BULK — múltiples fotos ─────────────────────────────────────────
  async createBulk(dto: CreateFotoDto, userId: number, files: Express.Multer.File[]) {
    const internoFolder = await this.resolveInternoFolder(dto.folderId);
    const internoName   = internoFolder?.name ?? dto.name ?? 'sin-interno';

    let fotosFolderId: number | undefined = undefined;
    if (internoFolder) {
      fotosFolderId = await this.getOrCreateFotosFolder(internoFolder.id, internoName, userId);
    }

    const results = await Promise.allSettled(
      files.map(async (file, i) => {
        const local = this.saveLocalFile(file, internoName);
        const foto  = await this.prisma.fotos.create({
          data: {
            ...dto,
            name:        `${dto.name} ${i + 1}`,
            userId,
            folderId:    fotosFolderId,
            url:         local.fullUrl,
            softwareUrl: local.encryptedToken,
          },
          include: this.defaultIncludes(),
        });
        await this.driveQueue.add(
          DRIVE_UPLOAD_JOB.SINGLE,
          { fotoId: foto.id, filePath: local.absolutePath, fileName: file.originalname, mimeType: file.mimetype, internoName },
          { priority: 10 },
        );
        return foto;
      }),
    );

    const saved  = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<any>).value);
    const failed = results.filter(r => r.status === 'rejected').length;

    return { data: saved, total: saved.length, failed, message: 'Fotos guardadas. Sincronización con Drive en proceso.' };
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
      this.prisma.fotos.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: this.defaultIncludes() }),
      this.prisma.fotos.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ── FIND ONE ──────────────────────────────────────────────────────────────
  async findOne(id: number) {
    const foto = await this.prisma.fotos.findFirst({ where: { id, deletedAt: null }, include: this.defaultIncludes() });
    if (!foto) throw new NotFoundException(`Foto #${id} no encontrada`);
    return foto;
  }

  // ── FIND BY REFERENCE ─────────────────────────────────────────────────────
  async findByReference(reference: string) {
    const fotos = await this.prisma.fotos.findMany({
      where:   { reference, deletedAt: null, active: true },
      select:  { id: true, softwareUrl: true, comment: true, name: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return { data: fotos, total: fotos.length };
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  async update(id: number, dto: UpdateFotoDto, userId: number) {
    await this.findOne(id);
    return this.prisma.fotos.update({ where: { id }, data: { ...dto, updatedBy: userId }, include: this.defaultIncludes() });
  }

  // ── SOFT DELETE ───────────────────────────────────────────────────────────
  async remove(id: number, userId: number) {
    await this.findOne(id);
    return this.prisma.fotos.update({ where: { id }, data: { deletedAt: new Date(), active: false, updatedBy: userId } });
  }

  // ── RESTORE ───────────────────────────────────────────────────────────────
  async restore(id: number, userId: number) {
    const foto = await this.prisma.fotos.findFirst({ where: { id } });
    if (!foto) throw new NotFoundException(`Foto #${id} no encontrada`);
    return this.prisma.fotos.update({ where: { id }, data: { deletedAt: null, active: true, updatedBy: userId } });
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