import {
  Controller,
  Get,
  Param,
  Res,
  Req,
  UseGuards,
  ParseIntPipe,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express'; // ✅ import type — fix error 1272
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * FilesController — Sirve archivos locales de forma segura.
 *
 * Todos los endpoints requieren:
 *   - JWT válido        (JwtAuthGuard)
 *   - Rol ADMIN o USER  (RolesGuard)
 *   - Verificación de ownership dentro del servicio
 *
 * NUNCA se expone la ruta física del servidor al cliente.
 * Se usan tokens encriptados almacenados en Folder.url como identificadores.
 */
@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'USER')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(private readonly filesService: FilesService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /files/folder/:folderId
  // Lista el contenido de una carpeta desde la BD
  // IMPORTANTE: debe ir ANTES de /:token para que NestJS no lo confunda
  // ─────────────────────────────────────────────────────────────────────────────
  @Get('folder/:folderId')
  async listFolder(
    @Param('folderId', ParseIntPipe) folderId: number,
    @Req() req: Request,
  ) {
    const user = req.user as { id: number; roles: string[] };

    return this.filesService.listFolderContents({
      folderId,
      userId: user.id,
      userRoles: user.roles,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /files/:token
  // Sirve un archivo o retorna listado de directorio usando el token de BD
  // ─────────────────────────────────────────────────────────────────────────────
  @Get(':token')
  async serveFile(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = req.user as { id: number; roles: string[] };

    this.logger.log(
      `[FilesController] userId=${user.id} solicitó token=${token.substring(0, 12)}...`,
    );

    const result = await this.filesService.resolveSecureFile({
      token,
      userId: user.id,
      userRoles: user.roles,
    });

    // Es un directorio → retornar listado como JSON
    if (result.isDirectory) {
      return res.status(HttpStatus.OK).json({
        folder: result.folder,
        files: result.files,
      });
    }

    // ✅ Fix error 2345 y 2769 — garantizamos que no son undefined
    if (!result.absolutePath || result.size === undefined) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'Archivo no encontrado' });
    }

    // Es un archivo → enviarlo como stream con headers correctos
    res.setHeader('Content-Type', result.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Length', result.size);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${result.filename ?? 'file'}"`,
    );
    // Seguridad: evita que el browser ejecute scripts embebidos
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.sendFile(result.absolutePath, { root: '/' });
  }
}