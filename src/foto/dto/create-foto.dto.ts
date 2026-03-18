import {
  IsString, IsOptional, IsInt, IsBoolean, IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFotoDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsUrl()
  softwareUrl?: string;

  @IsOptional()
  @IsUrl()
  driveUrl?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  folderId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  solicitudId?: number;
}