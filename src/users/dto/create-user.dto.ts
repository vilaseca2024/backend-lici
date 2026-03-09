import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {

  @ApiProperty({
    example: 'Juan Perez',
    description: 'Nombre del usuario',
  })
  @IsString()
  nombre: string;

  @ApiProperty({
    example: 'juan@email.com',
    description: 'Correo electrónico',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'Contraseña del usuario',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

}