import { Module } from '@nestjs/common';
import { DocumentosService }    from './documentos.service';
import { DocumentosController } from './documentos.controller';
import { PrismaModule }         from '../prisma/prisma.module';
import { GoogleDriveModule }    from '../google-drive/google-drive.module';
import { CommonModule }         from '../common/common.module';
import { QueueModule }          from '../queue/queue.module';

@Module({
  imports: [
    PrismaModule,
    GoogleDriveModule,   // GoogleDriveService (usado por el worker de BullMQ)
    CommonModule,        // EncryptionService
    QueueModule,         // DRIVE_UPLOAD_QUEUE
  ],
  controllers: [DocumentosController],
  providers:   [DocumentosService],
  exports:     [DocumentosService],
})
export class DocumentosModule {}