import { PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';
import { CreateReportFormatDto } from './create-reporte.dto';

export class UpdateReportFormatDto extends PartialType(CreateReportFormatDto) {
  @IsInt()
  @IsOptional()
  updatedBy?: number;
}