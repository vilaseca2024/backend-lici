import { Module } from '@nestjs/common';
import { FilesService }      from './files.service';
import { FilesController }   from './files.controller';
import { PrismaModule }      from '../prisma/prisma.module';
import { FolderModule }      from '../folder/folder.module';
import { CommonModule }      from '../common/common.module';  // ← EncryptionService

@Module({
  imports: [
    PrismaModule,
    FolderModule,   // FolderService (verifyFolderAccess, resolveLocalPath, buildFullUrl)
    CommonModule,   // EncryptionService + ConfigService
  ],
  controllers: [FilesController],
  providers:   [FilesService],
  exports:     [FilesService],
})
export class FilesModule {}