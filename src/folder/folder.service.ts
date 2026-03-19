import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { EncryptionService } from '../common/encryption.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { resolveStoragePath } from '../common/resolve-storage-path';

interface CreateFolderFromInternoParams {
  internoName: string;
  cliente?: string;
  userId: number;
}

interface FolderAccessParams {
  folderId: number;
  userId: number;
  userRoles: string[];
}

@Injectable()
export class FolderService {
  private readonly logger = new Logger(FolderService.name);

  private readonly localStorageRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly driveService: GoogleDriveService,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
  ) {
    this.localStorageRoot = resolveStoragePath(this.configService.get<string>('LOCAL_STORAGE_PATH'));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UTILIDADES PRIVADAS
  // ─────────────────────────────────────────────────────────────────────────────

  private ensureLocalDir(relativePath: string): string | null {
    try {
      const absolutePath = path.join(this.localStorageRoot, relativePath);
      if (!fs.existsSync(absolutePath)) {
        fs.mkdirSync(absolutePath, { recursive: true });
        this.logger.log(`[LocalStorage] Directorio creado: ${absolutePath}`);
      }
      return absolutePath;
    } catch (error) {
      this.logger.error(`[LocalStorage] Error creando directorio: ${error.message}`);
      return null;
    }
  }

  private encryptPath(relativePath: string): string {
    return this.encryptionService.encrypt(relativePath);
  }

  buildFullUrl(token: string): string {
    const baseUrl = this.configService.get<string>('APP_BASE_URL', 'http://localhost:3000');
    return `${baseUrl}/files/${token}`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CREACIÓN DE CARPETAS
  // ─────────────────────────────────────────────────────────────────────────────

  async createFromInterno(params: CreateFolderFromInternoParams) {
    const { internoName, cliente, userId } = params;

    const imcruzDriveId = await this.driveService.getOrCreateFolder(
      'IMCRUZ',
      this.configService.get<string>('GOOGLE_DRIVE_IMCRUZ_ID'),
    );

    const internoDriveId = await this.driveService.getOrCreateFolder(
      internoName,
      imcruzDriveId,
    );
    const driveUrl = this.driveService.getFolderUrl(internoDriveId);

    const rawToken    = `${internoName}${cliente ?? ''}`;
    const softwareUrl = this.encryptionService.encrypt(rawToken);

    const imcruzLocalPath  = this.ensureLocalDir('IMCRUZ');
    const internoLocalPath = this.ensureLocalDir(path.join('IMCRUZ', internoName));

    const internoToken = this.encryptPath(path.join('IMCRUZ', internoName));
    const imcruzToken  = this.encryptPath('IMCRUZ');

    if (!imcruzLocalPath || !internoLocalPath) {
      this.logger.warn('[LocalStorage] No se pudo crear el directorio físico. Continuando sin él.');
    }

    let imcruzFolder = await this.prisma.folder.findFirst({
      where: { name: 'IMCRUZ', parentId: null, deletedAt: null },
    });

    if (!imcruzFolder) {
      imcruzFolder = await this.prisma.folder.create({
        data: {
          name: 'IMCRUZ',
          driveUrl: this.driveService.getFolderUrl(imcruzDriveId),
          url: imcruzToken,
          userId,
        },
      });
      this.logger.log(`[BD] Carpeta IMCRUZ creada con id ${imcruzFolder.id}`);
    }

    let internoFolder = await this.prisma.folder.findFirst({
      where: { name: internoName, parentId: imcruzFolder.id, deletedAt: null },
      include: {
        children: true,
        files: { select: { id: true, name: true, driveUrl: true, url: true } },
        fotos: { select: { id: true, name: true, driveUrl: true, url: true } },
      },
    });

    if (!internoFolder) {
      internoFolder = await this.prisma.folder.create({
        data: {
          name: internoName,
          client: cliente,
          driveUrl,
          softwareUrl,
          url: internoToken,
          parentId: imcruzFolder.id,
          userId,
        },
        include: {
          children: true,
          files: { select: { id: true, name: true, driveUrl: true, url: true } },
          fotos: { select: { id: true, name: true, driveUrl: true, url: true } },
        },
      });
      this.logger.log(`[BD] Carpeta interno creada con id ${internoFolder.id}`);
    } else {
      this.logger.log(`[BD] Carpeta interno ya existía con id ${internoFolder.id}`);
    }

    return {
      folder: internoFolder,
      driveUrl,
      localPath: internoLocalPath,
      secureLocalUrl: this.buildFullUrl(internoToken),
      imcruzFolderId: imcruzFolder.id,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BÚSQUEDA POR NOMBRE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Busca un folder por nombre exacto (el internoTexto).
   * Usado por el frontend para obtener el folderId antes de subir documentos.
   * GET /folders/by-name/:name
   */
  // createSubfolder — crea subcarpeta local, en Drive, e idempotentemente en BD
  async createSubfolder(params: { name: string; parentId: number; userId: number }) {
    const { name, parentId, userId } = params;

    const existing = await this.prisma.folder.findFirst({
      where: { name, parentId, deletedAt: null },
    });
    if (existing) return existing;

    const parent = await this.prisma.folder.findFirst({
      where:  { id: parentId, deletedAt: null },
      select: { id: true, name: true, url: true, driveUrl: true },
    });
    if (!parent) throw new NotFoundException(`Folder padre #${parentId} no encontrado`);

    // 1. Manejo local (Filesystem)
    let parentRelativePath = '';
    if (parent.url) {
      try {
        parentRelativePath = this.encryptionService.decrypt(parent.url);
        // Fallback porsia es el token malo de antes
        if (parentRelativePath.startsWith('subfolder-')) parentRelativePath = '';
      } catch (e) {
        this.logger.warn(`No se pudo desencriptar url del padre. Usando raiz.`);
      }
    }
    const newRelativePath = path.join(parentRelativePath || 'IMCRUZ', name);
    this.ensureLocalDir(newRelativePath);
    const token = this.encryptionService.encrypt(newRelativePath);

    // 2. Manejo en Google Drive
    let driveUrl: string | null = null;
    if (parent.driveUrl) {
      const match = parent.driveUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
      const parentDriveId = match ? match[1] : null;
      if (parentDriveId) {
        try {
          const newDriveId = await this.driveService.getOrCreateFolder(name, parentDriveId);
          driveUrl = this.driveService.getFolderUrl(newDriveId);
        } catch (e) {
          this.logger.error(`Error creando subcarpeta en Drive: ${e.message}`);
        }
      }
    }

    return this.prisma.folder.create({
      data: { name, parentId, url: token, softwareUrl: token, driveUrl, userId, active: true },
    });
  }

  async findByName(name: string) {
    const folder = await this.prisma.folder.findFirst({
      where:  { name, deletedAt: null, active: true },
      select: { id: true, name: true, slug: true, driveUrl: true, url: true },
    });
    if (!folder) throw new NotFoundException(`Folder con nombre "${name}" no encontrado`);
    return folder;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ÁRBOL COMPLETO
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Devuelve el folder raíz cuyo nombre coincide con el internoTexto,
   * junto con TODA la jerarquía de children (recursiva) y los archivos
   * (File + Fotos) de cada nivel.
   * GET /folders/tree/:name
   */
  async findTreeByName(name: string) {
    const root = await this.prisma.folder.findFirst({
      where:  { name, deletedAt: null, active: true },
      select: { id: true },
    });
    if (!root) throw new NotFoundException(`Folder con nombre "${name}" no encontrado`);
    return this.loadSubtree(root.id);
  }

  /** Carga un folder con todos sus children, files y fotos (recursivo) */
  private async loadSubtree(folderId: number): Promise<any> {
    const folder = await this.prisma.folder.findFirst({
      where: { id: folderId, deletedAt: null, active: true },
      select: {
        id:       true,
        name:     true,
        slug:     true,
        driveUrl: true,
        children: {
          where:   { deletedAt: null, active: true },
          select:  { id: true },
          orderBy: { name: 'asc' },
        },
        files: {
          where:   { deletedAt: null, active: true },
          select: {
            id: true, name: true, type: true, reference: true,
            comment: true, status: true, url: true, softwareUrl: true,
            driveUrl: true, createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        fotos: {
          where:   { deletedAt: null, active: true },
          select: {
            id: true, name: true, type: true, reference: true,
            comment: true, status: true, url: true, softwareUrl: true,
            driveUrl: true, createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!folder) return null;

    const children = await Promise.all(
      folder.children.map((c) => this.loadSubtree(c.id)),
    );

    return { ...folder, children: children.filter(Boolean) };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONTROL DE ACCESO
  // ─────────────────────────────────────────────────────────────────────────────

  async verifyFolderAccess({ folderId, userId, userRoles }: FolderAccessParams) {
    const folder = await this.prisma.folder.findFirst({
      where: { id: folderId, deletedAt: null },
    });

    if (!folder) {
      throw new NotFoundException(`Carpeta con id ${folderId} no encontrada`);
    }

    const isAdmin = userRoles.includes('ADMIN');
    const isOwner = folder.userId === userId;

    if (!isAdmin && !isOwner) {
      this.logger.warn(
        `[Seguridad] Usuario ${userId} intentó acceder a carpeta ${folderId} sin permiso`,
      );
      throw new ForbiddenException('No tienes permiso para acceder a esta carpeta');
    }

    return folder;
  }

  resolveLocalPath(encryptedToken: string): string {
    const relativePath = this.encryptionService.decrypt(encryptedToken);
    return path.join(this.localStorageRoot, relativePath);
  }
}