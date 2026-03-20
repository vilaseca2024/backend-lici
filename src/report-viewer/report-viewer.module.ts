import { Module } from '@nestjs/common';
import { ReportViewerService } from './report-viewer.service';
import { ReportViewerController } from './report-viewer.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ExternalDbModule } from '../external-db/external-db.module';

@Module({
  imports: [
    PrismaModule,
    ExternalDbModule,   // exporta ExternalDbService
  ],
  controllers: [ReportViewerController],
  providers:   [ReportViewerService],
})
export class ReportViewerModule {}