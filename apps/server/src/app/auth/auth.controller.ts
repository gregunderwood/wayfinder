import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AdminProfile } from '@wayfinder/domain';
import type { Request, Response } from 'express';
import { AdminGuard, type AuthenticatedAdmin } from './admin.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { LOGIN_RATE_LIMIT, REFRESH_RATE_LIMIT } from './session';
import {
  clearSessionCookies,
  readRefreshCookie,
  setSessionCookies,
} from './session-cookies';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: LOGIN_RATE_LIMIT })
  async login(
    @Body() credentials: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const session = await this.auth.login(
      credentials.email,
      credentials.password,
    );
    setSessionCookies(response, session);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: REFRESH_RATE_LIMIT })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    try {
      const session = await this.auth.refresh(readRefreshCookie(request));
      setSessionCookies(response, session);
    } catch (error) {
      // Only a refused refresh: a passing server fault must not sign the admin out.
      if (error instanceof UnauthorizedException) {
        clearSessionCookies(response);
      }
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(readRefreshCookie(request));
    clearSessionCookies(response);
  }

  @Get('me')
  @UseGuards(AdminGuard)
  me(@CurrentUser() admin: AuthenticatedAdmin): Promise<AdminProfile> {
    return this.auth.profileOf(admin.id);
  }
}
