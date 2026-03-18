import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { ConfigService } from '@nestjs/config';
import { DRIVE_UPLOAD_QUEUE, DRIVE_UPLOAD_JOB } from './drive-upload.queue';

export interface DriveUploadJobData {
  fotoId:      number;
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
    const { fotoId, filePath, fileName, mimeType, internoName } = job.data;
    this.logger.log(`Procesando job #${job.id} — archivo: "${fileName}"`);

    // Leer archivo desde disco local
    const { readFileSync } = await import('fs');
    const buffer = readFileSync(filePath);

    // Resolver carpeta Drive
    const imcruzId  = await this.driveService.getOrCreateFolder(
      'IMCRUZ',
      this.config.get<string>('GOOGLE_DRIVE_IMCRUZ_ID'),
    );
    const internoId = await this.driveService.getOrCreateFolder(internoName, imcruzId);
    const fotosId   = await this.driveService.getOrCreateFolder('fotos', internoId);

    // Subir (ya tiene reintentos internos)
    const fileId = await this.driveService.uploadFile({
      name: fileName, mimeType, buffer, folderId: fotosId,
    });

    const driveUrl = this.driveService.getFileUrl(fileId);

    // Actualizar driveUrl en BD
    await this.prisma.fotos.update({
      where: { id: fotoId },
      data:  { driveUrl },
    });

    this.logger.log(`Job #${job.id} completado — driveUrl guardada para foto #${fotoId}`);
  }
}