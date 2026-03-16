import { Module } from '@nestjs/common';
import { InternoService } from './interno.service';
import { InternoController } from './interno.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InternoController],
  providers: [InternoService],
  exports: [InternoService],
})
export class InternoModule {}