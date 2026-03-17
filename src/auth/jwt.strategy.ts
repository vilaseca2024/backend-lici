import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'tu_super_secreto_jwt',
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const authHeader = req.headers['authorization'] || '';
    const token = (authHeader as string).replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Token missing');

    // Verificar sesión existente y no expirada
    const session = await this.prisma.session.findUnique({ where: { token } });
    if (!session) throw new UnauthorizedException('Session not found');
    if (new Date(session.expiresAt) < new Date()) {
      await this.prisma.session.deleteMany({ where: { id: session.id } });
      throw new UnauthorizedException('Session expired');
    }

    // Verificar usuario existe y no eliminado
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: { role: true },  // ✅ incluir el role completo para obtener el name
        },
      },
    });

    if (!user || user.deletedAt) throw new UnauthorizedException('User invalid');

    const { password, ...rest } = user as any;

    // ✅ Aplanamos los roles a un array de strings para que RolesGuard funcione
    // user.roles viene como UserRole[] → [{ role: { name: 'ADMIN' } }, ...]
    const roles: string[] = (user.roles ?? []).map((r: any) => r?.role?.name).filter(Boolean);

    return {
      ...rest,
      roles,           // ✅ ['ADMIN', 'USER', ...] — array de strings
      sessionId: session.id,
    };
  }
}