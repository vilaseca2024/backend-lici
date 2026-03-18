import { IsOptional, IsString, IsInt, IsBoolean, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class QueryFotoDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  folderId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  solicitudId?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  active?: boolean;
}