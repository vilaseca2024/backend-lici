import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'tu_super_secreto_jwt',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
      },
    }),
    UsersModule,
    PrismaModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}