import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { EncryptionService } from '../common/encryption.service';
import { ConfigService } from '@nestjs/config';

interface CreateFolderFromInternoParams {
  internoName: string;
  cliente?: string;
  userId: number;
}

@Injectable()
export class FolderService {
  private readonly logger = new Logger(FolderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly driveService: GoogleDriveService,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Crea o reutiliza la carpeta del interno, tanto en BD como en Google Drive.
   * Estructura Drive: IMCRUZ / <interno>
   */
  async createFromInterno(params: CreateFolderFromInternoParams) {
    const { internoName, cliente, userId } = params;

    // ─── 1. Obtener o crear carpeta IMCRUZ en Drive ───────────────────────────
    const imcruzDriveId = await this.driveService.getOrCreateFolder(
      'IMCRUZ',
      this.configService.get<string>('GOOGLE_DRIVE_IMCRUZ_ID'), // ID padre opcional en env
    );

    // ─── 2. Obtener o crear la carpeta del interno dentro de IMCRUZ en Drive ──
    const internoDriveId = await this.driveService.getOrCreateFolder(
      internoName,
      imcruzDriveId,
    );

    const driveUrl = this.driveService.getFolderUrl(internoDriveId);

    // ─── 3. softwareUrl: encriptado de interno+cliente ────────────────────────
    const rawSoftwareUrl = `${internoName}${cliente ?? ''}`;
    const softwareUrl = this.encryptionService.encrypt(rawSoftwareUrl);

    // ─── 4. Buscar o crear carpeta IMCRUZ en BD ───────────────────────────────
    let imcruzFolder = await this.prisma.folder.findFirst({
      where: { name: 'IMCRUZ', parentId: null, deletedAt: null },
    });

    if (!imcruzFolder) {
      imcruzFolder = await this.prisma.folder.create({
        data: {
          name: 'IMCRUZ',
          driveUrl: this.driveService.getFolderUrl(imcruzDriveId),
          userId,
        },
      });
      this.logger.log(`Carpeta IMCRUZ creada en BD con id ${imcruzFolder.id}`);
    }

    // ─── 5. Buscar o crear carpeta del interno en BD ──────────────────────────
    let internoFolder = await this.prisma.folder.findFirst({
      where: {
        name: internoName,
        parentId: imcruzFolder.id,
        deletedAt: null,
      },
      include: {
        children: true,
        files: { select: { id: true, name: true, driveUrl: true } },
        fotos: { select: { id: true, name: true, driveUrl: true } },
      },
    });

    if (!internoFolder) {
      internoFolder = await this.prisma.folder.create({
        data: {
          name: internoName,
          client: cliente,
          driveUrl,
          softwareUrl,
          parentId: imcruzFolder.id,
          userId,
        },
        include: {
          children: true,
          files: { select: { id: true, name: true, driveUrl: true } },
          fotos: { select: { id: true, name: true, driveUrl: true } },
        },
      });
      this.logger.log(`Carpeta interno creada en BD con id ${internoFolder.id}`);
    } else {
      this.logger.log(`Carpeta interno ya existía en BD con id ${internoFolder.id}`);
    }

    return {
      folder: internoFolder,
      driveUrl,
      imcruzFolderId: imcruzFolder.id,
    };
  }
}