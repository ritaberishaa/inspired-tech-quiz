import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div class="container">
      <h1>Inspired Tech Quiz</h1>
      <app-login *ngIf="currentView === 'login'"></app-login>
      <app-game-room *ngIf="currentView === 'room'"></app-game-room>
      <app-game *ngIf="currentView === 'game'"></app-game>
      <app-results *ngIf="currentView === 'results'"></app-results>
    </div>
  `,
  styles: []
})
export class AppComponent implements OnInit, OnDestroy {
  currentView = 'login';
  private navigationListener: any;

  ngOnInit(): void {
    this.navigationListener = (event: any) => {
      this.currentView = event.detail;
    };
    window.addEventListener('navigate', this.navigationListener);
  }

  ngOnDestroy(): void {
    if (this.navigationListener) {
      window.removeEventListener('navigate', this.navigationListener);
    }
  }
}

