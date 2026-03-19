import { IsOptional, IsString, IsInt, IsPositive, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryDocumentoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number;

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
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  folderId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  solicitudId?: number;

  // ?active=true  o  ?active=false
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true')  return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  active?: boolean;
}