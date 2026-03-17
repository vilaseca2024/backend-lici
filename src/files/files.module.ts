import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FolderModule } from '../folder/folder.module';

@Module({
  imports: [
    PrismaModule,
    FolderModule,   // Necesario para FolderService (verifyFolderAccess, resolveLocalPath, buildFullUrl)
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}