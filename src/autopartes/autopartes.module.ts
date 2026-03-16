import { Module } from '@nestjs/common';
import { AutopartesController } from './autopartes.controller';
import { AutopartesService } from './autopartes.service';

@Module({
  controllers: [AutopartesController],
  providers: [AutopartesService]
})
export class AutopartesModule {}
