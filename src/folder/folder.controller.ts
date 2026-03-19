import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FolderService } from './folder.service';

// TODO: cuando agregues JWT, importa JwtAuthGuard, RolesGuard y Roles,
// decora el controller con @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN','USER'),
// y reemplaza TEMP_USER_ID por (req.user as { id: number }).id en los métodos que lo usen.

const TEMP_USER_ID = 1; // ← reemplazar cuando haya auth

@Controller('folders')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

    // ── POST /folders/interno — crear carpeta desde un interno ────────────────
    // Crea en Drive + local + BD. Idempotente: si ya existe la reutiliza.
    @Post('interno')
    @HttpCode(HttpStatus.CREATED)
    createFromInterno(
        @Body('internoName') internoName: string,
        @Body('cliente')     cliente?:    string,
    ) {
        return this.folderService.createFromInterno({
        internoName,
        cliente,
        userId: TEMP_USER_ID,
        });
    }

    // ── GET /folders/by-name/:name — buscar folder por nombre (internoTexto) ──
    // IMPORTANTE: debe ir ANTES de /tree/:name y de /:id para que NestJS
    // no interprete "by-name" como un parámetro numérico.
    @Get('by-name/:name')
    findByName(@Param('name') name: string) {
        return this.folderService.findByName(name);
    }

    // ── GET /folders/tree/:name — árbol completo de un interno ───────────────
    // Devuelve el folder raíz + children recursivos + files + fotos de cada nivel.
    // Lo consume el DriveContainer para renderizar la jerarquía completa.
    @Get('tree/:name')
    findTree(@Param('name') name: string) {
        return this.folderService.findTreeByName(name);
    }

    // ── GET /folders/:id — obtener folder por id ──────────────────────────────
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.folderService.verifyFolderAccess({
        folderId:  id,
        userId:    TEMP_USER_ID,
        userRoles: ['ADMIN'],
        });
    }

  
    // ═══════════════════════════════════════════════════════════════════════════════
    // 2. AGREGAR al folder.controller.ts — POST /folders
    //    (ANTES de los @Get para evitar conflictos de ruta)
    // ═══════════════════════════════════════════════════════════════════════════════

    @Post()
    @HttpCode(HttpStatus.CREATED)
    createSubfolder(
    @Body('name')     name:     string,
    @Body('parentId') parentId: number,
    ) {
    return this.folderService.createSubfolder({
        name,
        parentId: Number(parentId),
        userId: TEMP_USER_ID,
    });
    }

}