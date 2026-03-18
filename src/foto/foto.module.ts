import { Module } from '@nestjs/common';
import { FotosService } from './foto.service';
import { FotosController } from './foto.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { CommonModule } from '../common/common.module';
import { QueueModule } from '../queue/queue.module';  // ← agregar

@Module({
  imports: [
    PrismaModule,
    GoogleDriveModule,
    CommonModule,
    QueueModule,  // ← agregar
  ],
  controllers: [FotosController],
  providers: [FotosService],
  exports: [FotosService],
})
export class FotoModule {}