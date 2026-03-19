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
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentosService }  from './documentos.service';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';
import { QueryDocumentoDto }  from './dto/query-documento.dto';

// TODO: cuando agregues JWT, importa JwtAuthGuard, RolesGuard y Roles,
// decora el controller con @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN','USER'),
// y reemplaza TEMP_USER_ID por (req.user as { id: number }).id

const TEMP_USER_ID = 1; // ← reemplazar cuando haya auth

const anyFileFilter = (
  _req: any,
  _file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => cb(null, true);

@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  // ── POST /documentos — subir un documento ────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), fileFilter: anyFileFilter }),
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
    const dto: CreateDocumentoDto = {
      name,
      ...(reference      && { reference }),
      ...(comment        && { comment }),
      ...(status         && { status }),
      ...(city           && { city }),
      ...(type           && { type }),
      ...(folderIdRaw    && { folderId:    Number(folderIdRaw) }),
      ...(solicitudIdRaw && { solicitudId: Number(solicitudIdRaw) }),
    };
    return this.documentosService.create(dto, TEMP_USER_ID, file);
  }

  // ── POST /documentos/bulk — subir múltiples documentos ───────────────────
  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('files', 20, { storage: memoryStorage(), fileFilter: anyFileFilter }),
  )
  createBulk(
    @UploadedFiles() files:        Express.Multer.File[],
    @Body('name')      name:        string,
    @Body('reference') reference:   string,
    @Body('comment')   comment:     string,
    @Body('folderId')  folderIdRaw: string,
  ) {
    const dto: CreateDocumentoDto = {
      name,
      ...(reference   && { reference }),
      ...(comment     && { comment }),
      ...(folderIdRaw && { folderId: Number(folderIdRaw) }),
    };
    return this.documentosService.createBulk(dto, TEMP_USER_ID, files);
  }

  // ── GET /documentos — listar con filtros y paginación ────────────────────
  @Get()
  findAll(@Query() query: QueryDocumentoDto) {
    return this.documentosService.findAll(query);
  }

  // ── GET /documentos/by-reference/:reference ──────────────────────────────
  // IMPORTANTE: debe ir ANTES de /:id
  @Get('by-reference/:reference')
  findByReference(@Param('reference') reference: string) {
    return this.documentosService.findByReference(reference);
  }

  // ── GET /documentos/:id ───────────────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.documentosService.findOne(id);
  }

  // ── PATCH /documentos/:id ─────────────────────────────────────────────────
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id:  number,
    @Body()                    dto: UpdateDocumentoDto,
  ) {
    return this.documentosService.update(id, dto, TEMP_USER_ID);
  }

  // ── DELETE /documentos/:id ────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.documentosService.remove(id, TEMP_USER_ID);
  }

  // ── PATCH /documentos/:id/restore ────────────────────────────────────────
  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.documentosService.restore(id, TEMP_USER_ID);
  }
}