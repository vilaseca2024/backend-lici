import {
  Controller,
  Get,
  Param,
  Res,
  ParseIntPipe,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesService }      from './files.service';
import { EncryptionService } from '../common/encryption.service';
import { ConfigService }     from '@nestjs/config';
import * as fs   from 'fs';
import * as path from 'path';
import { resolveStoragePath } from '../common/resolve-storage-path';
import * as mime from 'mime-types';

const TEMP_USER_ID    = 1;
const TEMP_USER_ROLES = ['ADMIN'];

@Controller('files')
export class FilesController {
  private readonly logger           = new Logger(FilesController.name);
  private readonly localStorageRoot: string;

  constructor(
    private readonly filesService:      FilesService,
    private readonly encryptionService: EncryptionService,
    private readonly configService:     ConfigService,
  ) {
    // ── Fix Windows: si LOCAL_STORAGE_PATH viene con slashes Unix (/var/www/...)
    // path.resolve lo convierte correctamente SIN duplicar la unidad.
    // Usamos path.normalize para limpiar separadores mixtos.
    this.localStorageRoot = resolveStoragePath(
      this.configService.get<string>('LOCAL_STORAGE_PATH'),
    );
  }

  // ── GET /files/folder/:folderId ───────────────────────────────────────────
  @Get('folder/:folderId')
  async listFolder(@Param('folderId', ParseIntPipe) folderId: number) {
    return this.filesService.listFolderContents({
      folderId,
      userId:    TEMP_USER_ID,
      userRoles: TEMP_USER_ROLES,
    });
  }

  // ── GET /files/:token ─────────────────────────────────────────────────────
  @Get(':token')
  serveFile(
    @Param('token') token: string,
    @Res()          res:   Response,
  ) {
    this.logger.log(`[FilesController] token=${token.substring(0, 16)}...`);

    try {
      // 1. Desencriptar token → ruta relativa
      const relPath = this.encryptionService.decrypt(token);

      // 2. Construir ruta absoluta
      //    path.join en vez de path.resolve evita duplicar la unidad en Windows
      const absolutePath = path.join(this.localStorageRoot, relPath);

      // 3. Prevenir path traversal
      const relative = path.relative(this.localStorageRoot, absolutePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        this.logger.warn(`[Seguridad] Path traversal: ${relPath}`);
        return res.status(HttpStatus.FORBIDDEN).json({ error: 'Acceso denegado' });
      }

      // 4. Verificar existencia
      if (!fs.existsSync(absolutePath)) {
        this.logger.warn(`[Files] No encontrado: ${absolutePath}`);
        return res.status(HttpStatus.NOT_FOUND).json({ error: 'Archivo no encontrado' });
      }

      const stat = fs.statSync(absolutePath);

      // 5. Es directorio → listar
      if (stat.isDirectory()) {
        const files = fs.readdirSync(absolutePath).map(filename => {
          const s = fs.statSync(path.join(absolutePath, filename));
          return { name: filename, size: s.size, isDirectory: s.isDirectory(), createdAt: s.birthtime, updatedAt: s.mtime };
        });
        return res.status(HttpStatus.OK).json({ path: relPath, files });
      }

      // 6. Es archivo → enviar
      const mimeType = mime.lookup(absolutePath) || 'application/octet-stream';
      const filename = path.basename(absolutePath);

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');

      return res.sendFile(absolutePath);

    } catch (err) {
      this.logger.error(`[Files] Error: ${(err as Error).message}`);
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Token inválido o expirado' });
    }
  }
}