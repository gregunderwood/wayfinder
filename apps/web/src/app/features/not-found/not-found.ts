import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo.service';

@Component({
  selector: 'wf-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-head wrap">
      <p class="eyebrow">404</p>
      <h1>Page not found</h1>
      <p class="lead">
        Nothing lives here. Try the <a routerLink="/">home page</a> or
        <a routerLink="/work">my work</a>.
      </p>
    </section>
  `,
})
export class NotFound {
  constructor() {
    inject(SeoService).set({
      title: 'Page not found',
      description: 'This page does not exist.',
      path: inject(Router).url,
      noindex: true,
    });
  }
}
