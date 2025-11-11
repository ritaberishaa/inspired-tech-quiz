import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-results',
  template: `
    <div class="card">
      <h2 class="text-center">Game Results</h2>
      
      <div *ngIf="results.length > 0">
        <table class="results-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let result of results; let i = index">
              <td>
                <span class="rank-badge" [ngClass]="'rank-' + (i + 1)">
                  {{ i + 1 }}
                </span>
              </td>
              <td>{{ result.playerName }}</td>
              <td><strong>{{ result.score }} pts</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="text-center mt-20">
          <button class="btn" (click)="playAgain()">Play Again</button>
        </div>
      </div>

      <div *ngIf="results.length === 0" class="text-center">
        <p>No results available</p>
        <button class="btn mt-20" (click)="goHome()">Go Home</button>
      </div>
    </div>
  `,
  styles: []
})
export class ResultsComponent implements OnInit {
  results: any[] = [];

  ngOnInit(): void {
    const resultsData = localStorage.getItem('gameResults');
    if (resultsData) {
      this.results = JSON.parse(resultsData);
    } else {
      // No results, redirect to home
      this.goHome();
    }
  }

  playAgain(): void {
    localStorage.removeItem('gameId');
    localStorage.removeItem('gameResults');
    localStorage.removeItem('gameQuestions');
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'login' }));
  }

  goHome(): void {
    localStorage.clear();
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'login' }));
  }
}

