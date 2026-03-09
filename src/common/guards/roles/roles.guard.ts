import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
 
@Injectable()
export class RolesGuard implements CanActivate {

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [
        context.getHandler(),
        context.getClass(),
      ],
    );

    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId: user.id,
        active: true,
        deletedAt: null
      },
      include: {
        role: true
      }
    });

    const roles = userRoles.map(r => r.role.name);

    return requiredRoles.some(role => roles.includes(role));
  }
}