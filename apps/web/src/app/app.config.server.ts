import { HttpBackend } from '@angular/common/http';
import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { INTERNAL_API_URL_FROM_ENV } from '../internal-api-url';
import { serverRoutes } from './app.routes.server';
import {
  INTERNAL_API_URL,
  InternalApiBackend,
} from './core/internal-api.backend';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: INTERNAL_API_URL, useValue: INTERNAL_API_URL_FROM_ENV },
    { provide: HttpBackend, useClass: InternalApiBackend },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
