import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Clock } from '../common/clock';
import { ACCESS_TOKEN_LIFETIME_MS } from './session';

const MS_PER_SECOND = 1_000;

interface AccessTokenClaims {
  sub: string;
  iat: number;
}

@Injectable()
export class AccessTokens {
  constructor(
    private readonly jwt: JwtService,
    private readonly clock: Clock,
  ) {}

  issue(adminId: string): string {
    const claims: AccessTokenClaims = {
      sub: adminId,
      iat: this.nowInSeconds(),
    };
    return this.jwt.sign(claims, {
      algorithm: 'HS256',
      expiresIn: ACCESS_TOKEN_LIFETIME_MS / MS_PER_SECOND,
    });
  }

  adminIdFrom(accessToken: string | undefined): string | null {
    if (!accessToken) {
      return null;
    }
    try {
      const { sub } = this.jwt.verify<AccessTokenClaims>(accessToken, {
        algorithms: ['HS256'],
        clockTimestamp: this.nowInSeconds(),
      });
      return sub;
    } catch {
      return null;
    }
  }

  private nowInSeconds(): number {
    return Math.floor(this.clock.now().getTime() / MS_PER_SECOND);
  }
}
