// src/interno/dto/query-interno-con-folder.dto.ts
import { IsOptional, IsString, IsInt, IsBoolean, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class QueryInternoConFolderDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  validado?: boolean;
}