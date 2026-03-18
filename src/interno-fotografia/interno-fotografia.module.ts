import { Module } from '@nestjs/common';
import { InternoFotografiaController } from './interno-fotografia.controller';
import { InternoFotografiaService } from './interno-fotografia.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ExternalDbModule } from 'src/external-db/external-db.module';
 
@Module({
  imports: [
    PrismaModule,
    ExternalDbModule,  
  ],
  controllers: [InternoFotografiaController],
  providers: [InternoFotografiaService],
  
})
export class InternoFotografiaModule {}

 