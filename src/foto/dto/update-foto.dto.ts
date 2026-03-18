import { PartialType } from '@nestjs/swagger';
import { CreateFotoDto } from './create-foto.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateFotoDto extends PartialType(CreateFotoDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}