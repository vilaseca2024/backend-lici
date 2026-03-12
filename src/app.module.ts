import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';

import { ExternalDbModule } from './external-db/external-db.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({
      isGlobal: true,
      ttl: 5 * 60 * 1000,
      max: 200,
    }),
    ExternalDbModule,
    PrismaModule,
    UsersModule,
  ],
})
export class AppModule {}