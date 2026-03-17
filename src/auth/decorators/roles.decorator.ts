import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator para indicar qué roles pueden acceder a un endpoint.
 * Uso: @Roles('ADMIN', 'USER')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);