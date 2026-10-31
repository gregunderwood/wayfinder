import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiErrorCode } from '@wayfinder/domain';
import { EditProjectLink } from './edit-project-link';

const BY_SLUG_URL = '/api/admin/projects/by-slug';
const PROJECT_ID = '7d3c1f9e-8a52-4b7e-9c11-2f6a0d4e5b83';

describe('EditProjectLink', () => {
  it('keeps the link for the project now shown when an earlier lookup fails late', async () => {
    TestBed.configureTestingModule({
      imports: [EditProjectLink],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EditProjectLink);
    const settle = async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    };

    fixture.componentRef.setInput('slug', 'gateway');
    fixture.detectChanges();
    const earlierLookup = backend.expectOne(`${BY_SLUG_URL}/gateway`);
    fixture.componentRef.setInput('slug', 'tempestas');
    fixture.detectChanges();
    backend.expectOne(`${BY_SLUG_URL}/tempestas`).flush({ id: PROJECT_ID });
    await settle();
    earlierLookup.flush(
      { code: ApiErrorCode.NotFound, message: 'There is no such project' },
      { status: 404, statusText: 'Not Found' },
    );
    await settle();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('href')).toBe(`/admin/projects/${PROJECT_ID}`);
    backend.verify();
  });
});
