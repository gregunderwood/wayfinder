import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseOptions, readDatabaseConfig } from '../database';
import { AuthModule } from './auth/auth.module';
import { GLOBAL_RATE_LIMIT } from './auth/session';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { JsonOnlyWritesGuard } from './common/json-only-writes.guard';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        databaseOptions(readDatabaseConfig((name) => config.get<string>(name))),
    }),
    ThrottlerModule.forRoot({ throttlers: [GLOBAL_RATE_LIMIT] }),
    HealthModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JsonOnlyWritesGuard },
  ],
})
export class AppModule {}
