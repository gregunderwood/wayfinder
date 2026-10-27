import '@angular/compiler';

import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { getTestBed } from '@angular/core/testing';

// The app runs zoneless, so tests do too: each spec provides
// provideZonelessChangeDetection() rather than loading zone.js here, and a
// component that only updates under zone.js fails its test instead of shipping.
getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
);
