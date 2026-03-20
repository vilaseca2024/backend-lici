import { Module } from '@nestjs/common';
import { ExternalDbService } from './external-db.service';
import { TrazabilidadService } from './trazabilidad.service';
import { TrazabilidadController } from './trazabilidad.controller';

@Module({
  providers: [ExternalDbService, TrazabilidadService],
  controllers: [TrazabilidadController],
  exports: [TrazabilidadService, ExternalDbService],
})
export class ExternalDbModule {}