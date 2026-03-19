import { Module } from '@nestjs/common';
import { FolderService }    from './folder.service';
import { FolderController } from './folder.controller';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { PrismaModule }      from '../prisma/prisma.module';
import { EncryptionService } from '../common/encryption.service';

@Module({
  imports: [GoogleDriveModule, PrismaModule],
  controllers: [FolderController],            // ← agregado
  providers:   [FolderService, EncryptionService],
  exports:     [FolderService],
})
export class FolderModule {}