import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { ConfigService } from '@nestjs/config';
import { DRIVE_UPLOAD_QUEUE, DRIVE_UPLOAD_JOB } from './drive-upload.queue';

export interface DriveUploadJobData {
  fotoId?:     number;
  fileId?:     number;
  entity?:     'foto' | 'file';
  driveFolderId?: string; // ID directo si ya es una subcarpeta real
  filePath:    string;   // ruta local absoluta
  fileName:    string;
  mimeType:    string;
  internoName: string;
}

@Processor(DRIVE_UPLOAD_QUEUE)
export class DriveUploadProcessor extends WorkerHost {
  private readonly logger = new Logger(DriveUploadProcessor.name);

  constructor(
    private readonly prisma:       PrismaService,
    private readonly driveService: GoogleDriveService,
    private readonly config:       ConfigService,
  ) {
    super();
  }

  async process(job: Job<DriveUploadJobData>): Promise<void> {
    const { fotoId, fileId, entity, driveFolderId, filePath, fileName, mimeType, internoName } = job.data;
    const isFile = entity === 'file';
    this.logger.log(`Procesando job #${job.id} — archivo: "${fileName}" (${entity || 'foto'})`);

    // Leer archivo desde disco local
    const { readFileSync } = await import('fs');
    const buffer = readFileSync(filePath);

    // Resolver carpeta Drive: si no pasaron un driveFolderId explícito, construimos la jerarquía predeterminada
    let targetFolderId = driveFolderId;
    
    if (!targetFolderId) {
      const imcruzId  = await this.driveService.getOrCreateFolder(
        'IMCRUZ',
        this.config.get<string>('GOOGLE_DRIVE_IMCRUZ_ID'),
      );
      const internoId = await this.driveService.getOrCreateFolder(internoName, imcruzId);
      
      const subfolderName = isFile ? 'documentos' : 'fotos';
      targetFolderId = await this.driveService.getOrCreateFolder(subfolderName, internoId);
    }

    // Subir (ya tiene reintentos internos)
    const driveFileId = await this.driveService.uploadFile({
      name: fileName, mimeType, buffer, folderId: targetFolderId,
    });

    const driveUrl = this.driveService.getFileUrl(driveFileId);

    // Actualizar driveUrl en BD
    if (isFile && fileId) {
      await this.prisma.file.update({
        where: { id: fileId },
        data:  { driveUrl },
      });
      this.logger.log(`Job #${job.id} completado — driveUrl guardada para file #${fileId}`);
    } else if (fotoId) {
      await this.prisma.fotos.update({
        where: { id: fotoId },
        data:  { driveUrl },
      });
      this.logger.log(`Job #${job.id} completado — driveUrl guardada para foto #${fotoId}`);
    } else {
      this.logger.warn(`Job #${job.id} alerta: Falta fotoId o fileId para actualizar BD.`);
    }
  }
}