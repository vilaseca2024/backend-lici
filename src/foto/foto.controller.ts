import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Res,
} from '@nestjs/common';
import { FotosService } from './foto.service';
import { EncryptionService } from '../common/encryption.service';
import { ConfigService } from '@nestjs/config';
import { UpdateFotoDto } from './dto/update-foto.dto';
import { QueryFotoDto } from './dto/query-foto.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

const imageFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.mimetype.startsWith('image/')) {
    cb(new Error('Solo se permiten imágenes'), false);
    return;
  }
  cb(null, true);
};

@Controller('fotos')
export class FotosController {
  private readonly localStorageRoot: string;

  constructor(
    private readonly fotosService: FotosService,
    private readonly encryption:   EncryptionService,
    private readonly config:       ConfigService,
  ) {
    this.localStorageRoot = this.config.get<string>(
      'LOCAL_STORAGE_PATH',
      path.join(process.cwd(), 'storage'),
    );
  }

  // ── POST /fotos — subir una foto ──────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), fileFilter: imageFilter }),
  )
  create(
    @UploadedFile() file:           Express.Multer.File,
    @Body('name')        name:           string,
    @Body('reference')   reference:      string,
    @Body('comment')     comment:        string,
    @Body('status')      status:         string,
    @Body('city')        city:           string,
    @Body('type')        type:           string,
    @Body('folderId')    folderIdRaw:    string,
    @Body('solicitudId') solicitudIdRaw: string,
  ) {
    const dto = {
      name,
      ...(reference      && { reference }),
      ...(comment        && { comment }),
      ...(status         && { status }),
      ...(city           && { city }),
      ...(type           && { type }),
      ...(folderIdRaw    && { folderId:    Number(folderIdRaw) }),
      ...(solicitudIdRaw && { solicitudId: Number(solicitudIdRaw) }),
    };
    return this.fotosService.create(dto as any, 1, file);
  }

  // ── POST /fotos/bulk — subir múltiples fotos ──────────────────────────────
  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('files', 20, { storage: memoryStorage(), fileFilter: imageFilter }),
  )
  createBulk(
    @UploadedFiles() files:        Express.Multer.File[],
    @Body('name')      name:        string,
    @Body('reference') reference:   string,
    @Body('comment')   comment:     string,
    @Body('folderId')  folderIdRaw: string,
  ) {
    const dto = {
      name,
      ...(reference   && { reference }),
      ...(comment     && { comment }),
      ...(folderIdRaw && { folderId: Number(folderIdRaw) }),
    };
    return this.fotosService.createBulk(dto as any, 1, files);
  }

  // ── GET /fotos — listar con filtros y paginación ──────────────────────────
  @Get()
  findAll(@Query() query: QueryFotoDto) {
    return this.fotosService.findAll(query);
  }

  // ── GET /fotos/files/:token — servir archivo local encriptado ─────────────
  @Get('files/:token')
  getFile(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    try {
      const relPath  = this.encryption.decrypt(token);
      const fullPath = path.resolve(this.localStorageRoot, relPath);

      // Validar que el path no salga del directorio raíz
      const relative = path.relative(this.localStorageRoot, fullPath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
      }

      res.sendFile(fullPath);
    } catch (err) {
      console.error('Error al servir archivo:', err);
      res.status(400).json({ error: 'Token inválido o expirado' });
    }
  }

  // ── GET /fotos/by-reference/:reference — fotos por referencia ────────────
  @Get('by-reference/:reference')
  findByReference(@Param('reference') reference: string) {
    return this.fotosService.findByReference(reference);
  }

  // ── GET /fotos/:id ────────────────────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.fotosService.findOne(id);
  }

  // ── PATCH /fotos/:id ──────────────────────────────────────────────────────
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFotoDto,
  ) {
    return this.fotosService.update(id, dto, 1);
  }

  // ── DELETE /fotos/:id ─────────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.fotosService.remove(id, 1);
  }

  // ── PATCH /fotos/:id/restore ──────────────────────────────────────────────
  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.fotosService.restore(id, 1);
  }
}