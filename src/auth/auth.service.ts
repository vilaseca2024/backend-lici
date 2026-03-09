import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  // Verifica credenciales (sin exponer diferencias)
  async validateUserCredentials(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);
    // Compare de todas formas para mitigar timing attacks
    if (!user) {
      // si no existe, hacemos una comparación con string fijo para igualar timing
      await bcrypt.compare(pass, '$2b$12$invalidsaltinvalidsaltinv'); // dummy
      return null;
    }
    const match = await bcrypt.compare(pass, (user as any).password);
    if (!match) return null;
    const { password, ...rest } = user as any;
    return rest;
  }

  async login(user: any, ip?: string, userAgent?: string) {
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);
    const expiresIn = Number(process.env.SESSION_EXPIRES_SECONDS || 3600);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Guardar sesión en BD
    await this.prisma.session.create({
      data: {
        userId: user.id,
        token,
        ipAddress: ip || null,
        userAgent: userAgent || null,
        expiresAt,
      },
    });

    return {
      access_token: token,
      expires_in: expiresIn,
      user: { id: user.id, nombre: user.nombre, email: user.email },
    };
  }

  async logout(token: string) {
    await this.prisma.session.deleteMany({ where: { token } });
    return { ok: true };
  }

  // Refresh simple: verificar sesión y crear nuevo token (opcional; aquí no implementado)
}