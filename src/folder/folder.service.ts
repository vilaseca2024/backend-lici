import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { EncryptionService } from '../common/encryption.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

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
    this.localStorageRoot = this.configService.get<string>(
      'LOCAL_STORAGE_PATH',
      path.join(process.cwd(), 'storage'),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UTILIDADES PRIVADAS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Crea el directorio físico si no existe y retorna la ruta absoluta.
   * Nunca lanza excepciones — registra el error y retorna null si falla.
   */
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

  /**
   * ✅ CORREGIDO: Guarda SOLO el token encriptado en BD.
   * La URL completa se construye en tiempo de respuesta usando APP_BASE_URL.
   * Así si cambia el dominio, solo se actualiza el .env — no la BD.
   */
  private encryptPath(relativePath: string): string {
    return this.encryptionService.encrypt(relativePath);
  }

  /**
   * Construye la URL completa a partir del token almacenado en BD.
   * Úsalo en el servicio de respuesta, NUNCA para guardar en BD.
   */
  buildFullUrl(token: string): string {
    const baseUrl = this.configService.get<string>('APP_BASE_URL', 'http://localhost:3000');
    return `${baseUrl}/files/${token}`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CREACIÓN DE CARPETAS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Crea o reutiliza la carpeta del interno:
   *   - En Google Drive:  IMCRUZ / <interno>
   *   - En almacenamiento local:  storage/IMCRUZ/<interno>/
   *
   * Guarda en el modelo Folder:
   *   - url         → ✅ SOLO el token encriptado (sin dominio ni base URL)
   *   - driveUrl    → URL pública de Google Drive
   *   - softwareUrl → Token encriptado (interno + cliente), usado internamente
   */
  async createFromInterno(params: CreateFolderFromInternoParams) {
    const { internoName, cliente, userId } = params;

    // ─── 1. Google Drive: obtener/crear carpeta IMCRUZ ───────────────────────
    const imcruzDriveId = await this.driveService.getOrCreateFolder(
      'IMCRUZ',
      this.configService.get<string>('GOOGLE_DRIVE_IMCRUZ_ID'),
    );

    // ─── 2. Google Drive: obtener/crear carpeta del interno ──────────────────
    const internoDriveId = await this.driveService.getOrCreateFolder(
      internoName,
      imcruzDriveId,
    );
    const driveUrl = this.driveService.getFolderUrl(internoDriveId);

    // ─── 3. softwareUrl: token encriptado (interno + cliente) ────────────────
    const rawToken = `${internoName}${cliente ?? ''}`;
    const softwareUrl = this.encryptionService.encrypt(rawToken);

    // ─── 4. Almacenamiento local: crear directorios físicos ──────────────────
    const imcruzLocalPath = this.ensureLocalDir('IMCRUZ');
    const internoLocalPath = this.ensureLocalDir(path.join('IMCRUZ', internoName));

    // ✅ Solo guardamos el token — sin base URL
    const internoToken = this.encryptPath(path.join('IMCRUZ', internoName));
    const imcruzToken  = this.encryptPath('IMCRUZ');

    if (!imcruzLocalPath || !internoLocalPath) {
      this.logger.warn('[LocalStorage] No se pudo crear el directorio físico. Continuando sin él.');
    }

    // ─── 5. BD: buscar o crear carpeta IMCRUZ ────────────────────────────────
    let imcruzFolder = await this.prisma.folder.findFirst({
      where: { name: 'IMCRUZ', parentId: null, deletedAt: null },
    });

    if (!imcruzFolder) {
      imcruzFolder = await this.prisma.folder.create({
        data: {
          name: 'IMCRUZ',
          driveUrl: this.driveService.getFolderUrl(imcruzDriveId),
          url: imcruzToken,   // ✅ Solo el token
          userId,
        },
      });
      this.logger.log(`[BD] Carpeta IMCRUZ creada con id ${imcruzFolder.id}`);
    }

    // ─── 6. BD: buscar o crear carpeta del interno ───────────────────────────
    let internoFolder = await this.prisma.folder.findFirst({
      where: {
        name: internoName,
        parentId: imcruzFolder.id,
        deletedAt: null,
      },
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
          url: internoToken,    // ✅ Solo el token — sin base URL
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
      localPath: internoLocalPath,                    // Solo uso interno del servidor
      secureLocalUrl: this.buildFullUrl(internoToken), // URL completa para mostrar al cliente
      imcruzFolderId: imcruzFolder.id,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONTROL DE ACCESO
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Verifica que el usuario tiene permiso para acceder a una carpeta.
   * Reglas:
   *   - ADMIN puede acceder a todo.
   *   - Cualquier otro rol solo puede acceder a carpetas que le pertenecen (userId).
   *
   * Lanza ForbiddenException si no tiene acceso.
   * Lanza NotFoundException si la carpeta no existe.
   */
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

  /**
   * Resuelve el token encriptado almacenado en BD
   * y retorna la ruta absoluta local del directorio.
   *
   * Úsalo en el endpoint GET /files/:token para servir archivos.
   * Siempre valida acceso antes de llamar a este método.
   */
  resolveLocalPath(encryptedToken: string): string {
    const relativePath = this.encryptionService.decrypt(encryptedToken);
    return path.join(this.localStorageRoot, relativePath);
  }
}