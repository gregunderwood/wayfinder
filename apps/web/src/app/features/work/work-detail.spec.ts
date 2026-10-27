import { RESPONSE_INIT, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WorkDetail } from './work-detail';

describe('WorkDetail', () => {
  function render(slug: string, response: ResponseInit | null = null) {
    TestBed.configureTestingModule({
      imports: [WorkDetail],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: RESPONSE_INIT, useValue: response },
      ],
    });
    const fixture = TestBed.createComponent(WorkDetail);
    fixture.componentRef.setInput('slug', slug);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders a project and its markdown body', () => {
    const host = render('tempestas');
    expect(host.querySelector('h1')?.textContent).toBe('Tempestas');
    expect(host.querySelector('.prose h2')).not.toBeNull();
  });

  it('answers 404 for an unknown slug instead of a soft 200', () => {
    const response: ResponseInit = {};
    const host = render('does-not-exist', response);
    expect(host.querySelector('h1')?.textContent).toBe('No such project');
    expect(response.status).toBe(404);
  });
});
