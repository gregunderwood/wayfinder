import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AdminProfile } from '@wayfinder/domain';
import { IsNull, Repository } from 'typeorm';
import { Clock } from '../common/clock';
import { DataCipher } from '../common/data-cipher';
import { isSameEmail, normaliseEmail } from './emails';
import { AdminUserEntity, RefreshTokenEntity } from './models';
import {
  hashPassword,
  isPasswordLongEnough,
  MIN_PASSWORD_LENGTH,
} from './passwords';

export class AdminAccountError extends Error {}

@Injectable()
export class AdminAccountsService {
  constructor(
    @InjectRepository(AdminUserEntity)
    private readonly admins: Repository<AdminUserEntity>,
    private readonly cipher: DataCipher,
    private readonly clock: Clock,
  ) {}

  async createAdmin(email: string, password: string): Promise<void> {
    requireLongEnoughPassword(password);
    if (await this.admins.exists()) {
      throw new AdminAccountError(
        'An admin already exists; use --reset-password to change its password',
      );
    }
    await this.admins.insert({
      encryptedEmail: this.cipher.encrypt(normaliseEmail(email)),
      passwordHash: await hashPassword(password),
    });
  }

  async resetPassword(email: string, password: string): Promise<void> {
    requireLongEnoughPassword(password);
    const admin = await this.findByEmail(email);
    if (!admin) {
      throw new AdminAccountError('There is no admin with that email');
    }
    const passwordHash = await hashPassword(password);
    await this.admins.manager.transaction(async (transaction) => {
      await transaction.update(AdminUserEntity, admin.id, { passwordHash });
      await transaction.update(
        RefreshTokenEntity,
        { adminUserId: admin.id, revokedAt: IsNull() },
        { revokedAt: this.clock.now() },
      );
    });
  }

  // There is only ever one admin, so the encrypted email never needs to be searchable.
  async findByEmail(email: string): Promise<AdminUserEntity | null> {
    const [admin] = await this.admins.find({ take: 1 });
    if (!admin) {
      return null;
    }
    return isSameEmail(this.cipher.decrypt(admin.encryptedEmail), email)
      ? admin
      : null;
  }

  async recordSignIn(adminId: string): Promise<void> {
    await this.admins.update(adminId, { lastLoginAt: this.clock.now() });
  }

  async profileOf(adminId: string): Promise<AdminProfile | null> {
    const admin = await this.admins.findOneBy({ id: adminId });
    if (!admin) {
      return null;
    }
    return {
      id: admin.id,
      email: this.cipher.decrypt(admin.encryptedEmail),
      lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
    };
  }
}

function requireLongEnoughPassword(password: string): void {
  if (!isPasswordLongEnough(password)) {
    throw new AdminAccountError(
      `The password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
}
