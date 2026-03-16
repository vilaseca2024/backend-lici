 
import { PartialType } from '@nestjs/swagger';
import { CreateInternoDto } from './create-interno.dto';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class UpdateInternoDto extends PartialType(CreateInternoDto) {
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsInt()
  @IsOptional()
  updatedBy?: number;
}