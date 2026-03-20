import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';

import { ExternalDbModule } from './external-db/external-db.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { InternoModule } from './interno/interno.module';
import { RolesModule } from './roles/roles.module';
import { ComparativaModule } from './comparativa/comparativa.module';
import { FotoModule } from './foto/foto.module';
import { InternoFotografiaModule } from './interno-fotografia/interno-fotografia.module';
import { QueueModule } from './queue/queue.module';
import { DocumentosModule } from './documentos/documentos.module';
import { FilesModule } from './files/files.module';
import { ReportesModule } from './reportes/reportes.module';
import { ReportViewerModule } from './report-viewer/report-viewer.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({
      isGlobal: true,
      ttl: 5 * 60 * 1000,
      max: 200,
    }),
    ExternalDbModule,
    PrismaModule,
    UsersModule,
    InternoModule,
    RolesModule,
    ComparativaModule,
    FotoModule,
    InternoFotografiaModule,
    QueueModule,
    DocumentosModule,
    FilesModule,
    ReportesModule,
    ReportViewerModule,
  ],
})
export class AppModule {}

