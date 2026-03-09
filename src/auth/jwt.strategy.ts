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
      passReqToCallback: true, // para poder leer token y comprobar session
    });
  }

  // Si passReqToCallback: el primer arg es req
  async validate(req: any, payload: any) {
    const authHeader = req.headers['authorization'] || '';
    const token = (authHeader as string).replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Token missing');

    // Verificar sesión existente y no expirada
    const session = await this.prisma.session.findUnique({ where: { token } });
    if (!session) throw new UnauthorizedException('Session not found');
    if (new Date(session.expiresAt) < new Date()) {
      // eliminar sesión vencida
      await this.prisma.session.deleteMany({ where: { id: session.id } });
      throw new UnauthorizedException('Session expired');
    }

    // Verificar usuario existe y no eliminado
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: true },
    });
    if (!user || user.deletedAt) throw new UnauthorizedException('User invalid');

    // Devuelve el objeto que estará en request.user
    const { password, ...rest } = user as any;
    return { ...rest, sessionId: session.id };
  }
}