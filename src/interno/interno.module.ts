import { Module } from '@nestjs/common';
import { InternoService } from './interno.service';
import { InternoController } from './interno.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FolderModule } from 'src/folder/folder.module';

@Module({
  imports: [PrismaModule, FolderModule], 
  controllers: [InternoController],
  providers: [InternoService],
  exports: [InternoService],
})
export class InternoModule {}