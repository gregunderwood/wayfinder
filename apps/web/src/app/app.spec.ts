import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('offers a skip link that targets the main landmark', () => {
    const host = render();
    const skipLink = host.querySelector<HTMLAnchorElement>('a.skip-link');
    expect(skipLink?.getAttribute('href')).toBe('#main');
    expect(host.querySelector('main#main')).not.toBeNull();
  });

  it('labels the primary navigation and links every top-level page', () => {
    const nav = render().querySelector('nav[aria-label="Primary"]');
    const labels = Array.from(nav?.querySelectorAll('a') ?? []).map((link) =>
      link.textContent?.trim(),
    );
    expect(labels).toEqual(['Work', 'About', 'Résumé', 'Contact']);
  });

  it('never prints a street address or phone number', () => {
    const text = render().textContent ?? '';
    expect(text).not.toMatch(/\(\d{3}\)\s*\d{3}-\d{4}/);
    expect(text).not.toMatch(/Meadow Creek Road|PO \d+/i);
  });
});
