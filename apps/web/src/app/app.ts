import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NxWelcome } from './nx-welcome';

@Component({
  imports: [NxWelcome, RouterModule],
  selector: 'gu-root',
  templateUrl: './app.html',
  styles: ``,
})
export class App {
  protected title = 'web';
}
