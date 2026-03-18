import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DriveUploadProcessor } from './drive-upload.processor';
import { DRIVE_UPLOAD_QUEUE } from './drive-upload.queue';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: DRIVE_UPLOAD_QUEUE,
      defaultJobOptions: {
        attempts:    3,          // reintentos automáticos
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,   // guarda los últimos 100 jobs completados
        removeOnFail:     50,    // guarda los últimos 50 fallidos para debuggear
      },
    }),
    GoogleDriveModule,
    PrismaModule,
  ],
  providers: [DriveUploadProcessor],
  exports:   [BullModule],
})
export class QueueModule {}