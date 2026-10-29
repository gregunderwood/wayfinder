import type { LoginPayload } from '@wayfinder/domain';
import { IsEmail, IsString, MaxLength } from 'class-validator';

const LONGEST_EMAIL = 254;
// argon2 hashes whatever it is given; an unbounded password is a cheap way to burn CPU.
const LONGEST_PASSWORD = 1024;

export class LoginDto implements LoginPayload {
  @IsEmail()
  @MaxLength(LONGEST_EMAIL)
  email!: string;

  @IsString()
  @MaxLength(LONGEST_PASSWORD)
  password!: string;
}
