import { Component, OnInit, OnDestroy } from '@angular/core';
import { FirebaseGameService } from '../../services/firebase-game.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-game-room',
  template: `
    <div class="card">
      <h2 class="text-center">Game Room</h2>
      <div class="text-center">
        <div class="game-id">Game ID: {{ gameId }}</div>
        <p class="mb-20">Share this code with your friends!</p>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>
      <div *ngIf="success" class="success">{{ success }}</div>

      <div class="mb-20">
        <h3>Players ({{ players.length }}/5)</h3>
        <ul class="player-list">
          <li class="player-item" *ngFor="let player of players">
            {{ player.name }}
          </li>
        </ul>
      </div>

      <div class="mb-20">
        <h3>Ready Status: {{ readyCount }}/{{ players.length }}</h3>
        <ul class="player-list">
          <li class="player-item" *ngFor="let player of players">
            {{ player.name }} 
            <span *ngIf="player.id === playerId && isReady" style="color: #000; margin-left: 10px; font-weight: bold;">✓ Ready</span>
            <span *ngIf="player.id === playerId && !isReady" style="color: #666; margin-left: 10px;">⏳ Waiting...</span>
            <span *ngIf="player.id !== playerId" style="color: #999; margin-left: 10px;">...</span>
          </li>
        </ul>
      </div>

      <div class="flex flex-column align-center gap-16">
        <button 
          class="btn" 
          (click)="markReady()"
          [disabled]="isReady || gameStarted || players.length === 0"
        >
          <span *ngIf="isReady">✓ Ready!</span>
          <span *ngIf="!isReady">I'm Ready!</span>
        </button>
        <p *ngIf="!allReady && players.length > 0" class="text-center">
          Waiting for all players to be ready ({{ readyCount }}/{{ players.length }})
        </p>
        <p *ngIf="allReady" class="success text-center">
          All players ready! Game starting...
        </p>
      </div>
    </div>
  `,
  styles: []
})
export class GameRoomComponent implements OnInit, OnDestroy {
  gameId = '';
  playerName = '';
  playerId = '';
  players: any[] = [];
  isHost = false;
  gameStarted = false;
  error = '';
  success = '';
  isReady = false;
  readyCount = 0;
  allReady = false;
  readyPlayers = new Set<string>();
  
  private subscriptions = new Subscription();

  constructor(private gameService: FirebaseGameService) {}

  ngOnInit(): void {
    this.gameId = localStorage.getItem('gameId') || '';
    this.playerName = localStorage.getItem('playerName') || '';
    this.playerId = localStorage.getItem('playerId') || '';
    
    if (!this.gameId || !this.playerName) {
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'login' }));
      return;
    }

    // Join the game
    this.gameService.joinGame(this.gameId, this.playerName).subscribe({
      next: (data) => {
        this.playerId = data.playerId;
        localStorage.setItem('playerId', data.playerId);
        this.success = 'Joined game successfully!';
      },
      error: (err) => {
        this.error = err.message || 'Failed to join game';
      }
    });

    // Listen for player joins
    this.subscriptions.add(
      this.gameService.onPlayerJoined().subscribe(data => {
        this.players = data.players;
        this.readyCount = data.readyCount || 0;
        // First player (index 0) is the host
        this.isHost = this.players.length > 0 && this.players[0].id === this.playerId;
      })
    );

    // Listen for player leaves
    this.subscriptions.add(
      this.gameService.onPlayerLeft().subscribe(data => {
        this.players = data.players;
        // Recalculate host after player leaves
        this.isHost = this.players.length > 0 && this.players[0].id === this.playerId;
      })
    );

    // Listen for game start
    this.subscriptions.add(
      this.gameService.onGameStarted().subscribe((data) => {
        console.log('Game started event received', data);
        this.gameStarted = true;
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('navigate', { detail: 'game' }));
        }, 500);
      })
    );

    // Listen for player ready updates
    this.subscriptions.add(
      this.gameService.onPlayerReadyUpdate().subscribe(data => {
        this.readyCount = data.readyCount;
        this.allReady = data.allReady;
        if (data.allReady) {
          this.gameStarted = true;
        }
      })
    );

    // Listen for errors
    this.subscriptions.add(
      this.gameService.onError().subscribe(err => {
        this.error = err.message;
      })
    );
  }

  markReady(): void {
    if (!this.isReady && !this.gameStarted) {
      this.gameService.playerReady(this.gameId);
      this.isReady = true;
      this.readyPlayers.add(this.playerId);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}

