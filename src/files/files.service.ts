import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FolderService } from '../folder/folder.service';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';

interface ServeFileParams {
  token: string;
  userId: number;
  userRoles: string[];
}

interface ListFolderParams {
  folderId: number;
  userId: number;
  userRoles: string[];
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly folderService: FolderService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // SERVIR ARCHIVO LOCAL DE FORMA SEGURA
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Resuelve un token encriptado → ruta física → stream del archivo.
   *
   * Flujo de seguridad:
   *   1. Desencripta el token para obtener la ruta absoluta local
   *   2. Previene path traversal (../)
   *   3. Verifica que la carpeta padre exista en BD usando el token directamente
   *   4. Verifica que el usuario tenga acceso (ADMIN o dueño)
   *   5. Retorna metadata + ruta absoluta para que el controller haga sendFile
   */
  async resolveSecureFile({ token, userId, userRoles }: ServeFileParams) {
    // ─── 1. Desencriptar token → ruta absoluta ────────────────────────────────
    let absolutePath: string;
    try {
      absolutePath = this.folderService.resolveLocalPath(token);
    } catch {
      throw new BadRequestException('Token inválido o expirado');
    }

    // ─── 2. Prevenir path traversal ──────────────────────────────────────────
    const normalizedPath = path.normalize(absolutePath);
    if (normalizedPath.includes('..')) {
      this.logger.warn(`[Seguridad] Path traversal detectado por userId ${userId}`);
      throw new ForbiddenException('Acceso denegado');
    }

    // ─── 3. Verificar que el recurso existe físicamente ──────────────────────
    if (!fs.existsSync(normalizedPath)) {
      throw new NotFoundException('El recurso solicitado no existe en el servidor');
    }

    // ─── 4. Buscar carpeta en BD por token (url = token, sin base URL) ────────
    //    ✅ Buscamos por el token exacto que guardamos en BD
    const folder = await this.prisma.folder.findFirst({
      where: {
        url: token,       // ✅ Comparamos token directo — no URL completa
        deletedAt: null,
      },
    });

    if (!folder) {
      throw new NotFoundException('Carpeta no registrada en el sistema');
    }

    // ─── 5. Verificar permisos (ADMIN o dueño) ───────────────────────────────
    await this.folderService.verifyFolderAccess({
      folderId: folder.id,
      userId,
      userRoles,
    });

    // ─── 6. Si es directorio → retornar listado ──────────────────────────────
    const stat = fs.statSync(normalizedPath);

    if (stat.isDirectory()) {
      const files = fs.readdirSync(normalizedPath).map((filename) => {
        const filePath = path.join(normalizedPath, filename);
        const fileStat = fs.statSync(filePath);
        return {
          name: filename,
          size: fileStat.size,
          isDirectory: fileStat.isDirectory(),
          createdAt: fileStat.birthtime,
          updatedAt: fileStat.mtime,
        };
      });

      return { isDirectory: true, files, folder };
    }

    // ─── 7. Es un archivo → retornar metadata para stream ────────────────────
    const mimeType = mime.lookup(normalizedPath) || 'application/octet-stream';
    const filename = path.basename(normalizedPath);

    return {
      isDirectory: false,
      absolutePath: normalizedPath,
      mimeType,
      filename,
      size: stat.size,
      folder,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LISTAR ARCHIVOS DE UNA CARPETA (desde BD)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Lista el contenido de una carpeta desde la BD.
   * Las URLs devueltas al cliente son URLs completas construidas en tiempo de respuesta.
   */
  async listFolderContents({ folderId, userId, userRoles }: ListFolderParams) {
    // Verifica acceso a la carpeta
    const folder = await this.folderService.verifyFolderAccess({
      folderId,
      userId,
      userRoles,
    });

    const [files, fotos, children] = await this.prisma.$transaction([
      this.prisma.file.findMany({
        where: { folderId, deletedAt: null },
        select: {
          id: true,
          name: true,
          type: true,
          reference: true,
          comment: true,
          status: true,
          url: true,
          driveUrl: true,
          createdAt: true,
        },
      }),
      this.prisma.fotos.findMany({
        where: { folderId, deletedAt: null },
        select: {
          id: true,
          name: true,
          type: true,
          reference: true,
          comment: true,
          status: true,
          url: true,
          driveUrl: true,
          createdAt: true,
        },
      }),
      this.prisma.folder.findMany({
        where: { parentId: folderId, deletedAt: null },
        select: {
          id: true,
          name: true,
          url: true,
          driveUrl: true,
          createdAt: true,
        },
      }),
    ]);

    // ✅ Construimos la URL completa en tiempo de respuesta usando el token de BD
    return {
      folder: {
        id: folder.id,
        name: folder.name,
        url: folder.url ? this.folderService.buildFullUrl(folder.url) : null,
        driveUrl: folder.driveUrl,
      },
      children: children.map((c) => ({
        ...c,
        url: c.url ? this.folderService.buildFullUrl(c.url) : null,
      })),
      files,
      fotos,
    };
  }
}