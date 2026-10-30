import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

const PROXY_HOPS_IN_FRONT = 1;

export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  app.disable('x-powered-by');
  // Caddy is the one proxy: trusting fewer hops rate-limits Caddy itself, trusting more lets
  // a forged X-Forwarded-For dodge the limit.
  app.set('trust proxy', PROXY_HOPS_IN_FRONT);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
