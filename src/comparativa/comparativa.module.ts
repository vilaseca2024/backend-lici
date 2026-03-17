import { Module } from '@nestjs/common';
import { ComparativaService } from './comparativa.service';
import { ComparativaController } from './comparativa.controller';
import { ExternalDbModule } from '../external-db/external-db.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ExternalDbModule, PrismaModule],
  controllers: [ComparativaController],
  providers: [ComparativaService],
})
export class ComparativaModule {}