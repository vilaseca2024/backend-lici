import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateInternoDto {
  @IsString()
  @IsNotEmpty()
  interno: string;

  @IsBoolean()
  @IsOptional()
  validado?: boolean;

  @IsString()
  @IsOptional()
  cliente?: string;

  @IsString()
  @IsOptional()
  estado?: string;

  @IsInt()
  @IsNotEmpty()
  userId: number;
}