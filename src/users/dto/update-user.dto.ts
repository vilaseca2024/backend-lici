import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {

  @ApiPropertyOptional({
    example: 'Nuevo Nombre',
  })
  nombre?: string;

}