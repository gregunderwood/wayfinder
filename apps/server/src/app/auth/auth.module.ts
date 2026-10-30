import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clock, SystemClock } from '../common/clock';
import { DataCipher, readDataEncryptionKey } from '../common/data-cipher';
import { AccessTokens } from './access-tokens';
import { AdminAccountsService } from './admin-accounts.service';
import { AdminGuard } from './admin.guard';
import { readJwtSecret } from './auth-config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminUserEntity, RefreshTokenEntity } from './models';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUserEntity, RefreshTokenEntity]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: readJwtSecret((name) => config.get<string>(name)),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: Clock, useClass: SystemClock },
    {
      provide: DataCipher,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new DataCipher(
          readDataEncryptionKey((name) => config.get<string>(name)),
        ),
    },
    AccessTokens,
    AdminAccountsService,
    AuthService,
    AdminGuard,
  ],
  exports: [AccessTokens, AdminGuard],
})
export class AuthModule {}
