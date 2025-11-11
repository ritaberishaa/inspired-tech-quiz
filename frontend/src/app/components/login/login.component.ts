import { Component } from '@angular/core';
import { FirebaseGameService } from '../../services/firebase-game.service';

@Component({
  selector: 'app-login',
  template: `
    <div class="card">
      <h2 class="text-center">Welcome to Quiz!</h2>
      <div class="flex flex-column align-center gap-16">
        <input 
          type="text" 
          class="input" 
          placeholder="Enter your name"
          [(ngModel)]="playerName"
          (keyup.enter)="showJoin ? joinGame() : createGame()"
          [disabled]="loading"
        />
        
        <div *ngIf="!showJoin" class="flex flex-column align-center gap-16" style="width: 100%;">
          <button 
            class="btn" 
            (click)="createGame()"
            [disabled]="!playerName || loading"
          >
            {{ loading ? 'Creating...' : 'Create Game' }}
          </button>
          <button 
            class="btn" 
            (click)="showJoin = true"
            [disabled]="loading"
          >
            Join Existing Game
          </button>
        </div>

        <div *ngIf="showJoin" class="flex flex-column align-center gap-16" style="width: 100%;">
          <input 
            type="text" 
            class="input" 
            placeholder="Enter Game ID"
            [(ngModel)]="gameId"
            (keyup.enter)="joinGame()"
            [disabled]="loading"
            style="text-transform: uppercase;"
          />
          <button 
            class="btn" 
            (click)="joinGame()"
            [disabled]="!playerName || !gameId || loading"
          >
            {{ loading ? 'Joining...' : 'Join Game' }}
          </button>
          <button 
            class="btn" 
            (click)="showJoin = false; gameId = ''"
            [disabled]="loading"
            style="background: #666;"
          >
            Back
          </button>
        </div>

        <div *ngIf="error" class="error">{{ error }}</div>
      </div>
    </div>
  `,
  styles: []
})
export class LoginComponent {
  playerName = '';
  gameId = '';
  showJoin = false;
  loading = false;
  error = '';

  constructor(private gameService: FirebaseGameService) {}

  createGame(): void {
    if (!this.playerName.trim()) {
      this.error = 'Please enter your name';
      return;
    }

    this.loading = true;
    this.error = '';

    this.gameService.createGame().subscribe({
      next: (data) => {
        // Store player name and game ID
        localStorage.setItem('playerName', this.playerName);
        localStorage.setItem('gameId', data.gameId);
        
        // Navigate to game room
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'room' }));
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to create game';
        this.loading = false;
      }
    });
  }

  joinGame(): void {
    if (!this.playerName.trim()) {
      this.error = 'Please enter your name';
      return;
    }

    if (!this.gameId.trim()) {
      this.error = 'Please enter a game ID';
      return;
    }

    this.loading = true;
    this.error = '';

    this.gameService.joinGame(this.gameId.toUpperCase().trim(), this.playerName).subscribe({
      next: (data) => {
        // Store player name and game ID
        localStorage.setItem('playerName', this.playerName);
        localStorage.setItem('gameId', data.gameId);
        
        // Navigate to game room
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'room' }));
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to join game';
        this.loading = false;
      }
    });
  }
}

