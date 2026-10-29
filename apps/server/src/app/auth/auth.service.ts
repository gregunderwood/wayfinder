import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AdminProfile, ApiErrorCode } from '@wayfinder/domain';
import { IsNull, Repository } from 'typeorm';
import { Clock } from '../common/clock';
import { AccessTokens } from './access-tokens';
import { AdminAccountsService } from './admin-accounts.service';
import { RefreshTokenEntity } from './models';
import { hashThatMatchesNoPassword, verifyPassword } from './passwords';
import { generateRefreshToken, hashRefreshToken } from './refresh-tokens';
import { type IssuedSession, REFRESH_TOKEN_LIFETIME_MS } from './session';

@Injectable()
export class AuthService {
  constructor(
    private readonly adminAccounts: AdminAccountsService,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokens: Repository<RefreshTokenEntity>,
    private readonly accessTokens: AccessTokens,
    private readonly clock: Clock,
  ) {}

  async login(email: string, password: string): Promise<IssuedSession> {
    const admin = await this.adminAccounts.findByEmail(email);
    const passwordHash =
      admin?.passwordHash ?? (await hashThatMatchesNoPassword());
    const isPasswordCorrect = await verifyPassword(passwordHash, password);
    if (!admin || !isPasswordCorrect) {
      throw new UnauthorizedException({
        code: ApiErrorCode.InvalidCredentials,
        message: 'The email or password is incorrect',
      });
    }
    await this.adminAccounts.recordSignIn(admin.id);
    return this.startSession(admin.id, randomUUID());
  }

  async refresh(presentedToken: string | undefined): Promise<IssuedSession> {
    const storedToken = await this.findStoredToken(presentedToken);
    if (!storedToken || this.hasExpired(storedToken)) {
      throw sessionEnded();
    }
    // Losing the race to revoke means the token was already used, so it was copied.
    const isFirstUse = await this.revokeIfActive(storedToken);
    if (!isFirstUse) {
      await this.revokeFamily(storedToken.familyId);
      throw sessionEnded();
    }
    return this.startSession(storedToken.adminUserId, storedToken.familyId);
  }

  async logout(presentedToken: string | undefined): Promise<void> {
    const storedToken = await this.findStoredToken(presentedToken);
    if (storedToken) {
      await this.revokeFamily(storedToken.familyId);
    }
  }

  async profileOf(adminId: string): Promise<AdminProfile> {
    const profile = await this.adminAccounts.profileOf(adminId);
    if (!profile) {
      throw sessionEnded();
    }
    return profile;
  }

  private async startSession(
    adminId: string,
    familyId: string,
  ): Promise<IssuedSession> {
    const refreshToken = generateRefreshToken();
    await this.refreshTokens.insert({
      adminUserId: adminId,
      familyId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(
        this.clock.now().getTime() + REFRESH_TOKEN_LIFETIME_MS,
      ),
    });
    return { accessToken: this.accessTokens.issue(adminId), refreshToken };
  }

  private async findStoredToken(
    presentedToken: string | undefined,
  ): Promise<RefreshTokenEntity | null> {
    if (!presentedToken) {
      return null;
    }
    return this.refreshTokens.findOneBy({
      tokenHash: hashRefreshToken(presentedToken),
    });
  }

  private hasExpired(storedToken: RefreshTokenEntity): boolean {
    return storedToken.expiresAt <= this.clock.now();
  }

  private async revokeIfActive(
    storedToken: RefreshTokenEntity,
  ): Promise<boolean> {
    const result = await this.refreshTokens.update(
      { id: storedToken.id, revokedAt: IsNull() },
      { revokedAt: this.clock.now() },
    );
    return result.affected === 1;
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.refreshTokens.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: this.clock.now() },
    );
  }
}

function sessionEnded(): UnauthorizedException {
  return new UnauthorizedException({
    code: ApiErrorCode.Unauthorized,
    message: 'The session has ended; sign in again',
  });
}
