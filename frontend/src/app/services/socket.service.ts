import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  private readonly serverUrl = environment.serverUrl;

  constructor() {
    this.socket = io(this.serverUrl);
  }

  // Game creation
  createGame(): Observable<{ gameId: string }> {
    return new Observable(observer => {
      this.socket.emit('create-game');
      this.socket.once('game-created', (data: { gameId: string }) => {
        observer.next(data);
        observer.complete();
      });
    });
  }

  // Join game
  joinGame(gameId: string, playerName: string): Observable<{ gameId: string; playerId: string }> {
    return new Observable(observer => {
      this.socket.emit('join-game', { gameId, playerName });
      this.socket.once('joined-game', (data: { gameId: string; playerId: string }) => {
        observer.next(data);
        observer.complete();
      });
      this.socket.once('error', (data: { message: string }) => {
        observer.error(data);
      });
    });
  }

  // Player ready
  playerReady(gameId: string): void {
    this.socket.emit('player-ready', { gameId });
  }


  // Submit answer
  submitAnswer(gameId: string, answer: string): Observable<{ received: boolean }> {
    return new Observable(observer => {
      this.socket.emit('submit-answer', { gameId, answer });
      this.socket.once('answer-received', (data: { received: boolean }) => {
        observer.next(data);
        observer.complete();
      });
    });
  }

  // Listeners
  onPlayerJoined(): Observable<{ players: any[]; playerCount: number; readyCount?: number }> {
    return new Observable(observer => {
      this.socket.on('player-joined', (data: { players: any[]; playerCount: number; readyCount?: number }) => {
        observer.next(data);
      });
    });
  }

  onPlayerLeft(): Observable<{ players: any[]; playerCount: number }> {
    return new Observable(observer => {
      this.socket.on('player-left', (data: { players: any[]; playerCount: number }) => {
        observer.next(data);
      });
    });
  }

  onGameStarted(): Observable<{ question: any; questionNumber: number; totalQuestions: number }> {
    return new Observable(observer => {
      const handler = (data: { question: any; questionNumber: number; totalQuestions: number }) => {
        console.log('Socket received game-started event', data);
        observer.next(data);
      };
      this.socket.on('game-started', handler);
      
      // Return cleanup function
      return () => {
        this.socket.off('game-started', handler);
      };
    });
  }

  onNewQuestion(): Observable<{ question: any; questionNumber: number; totalQuestions: number; timeLeft: number }> {
    return new Observable(observer => {
      this.socket.on('new-question', (data: { question: any; questionNumber: number; totalQuestions: number; timeLeft: number }) => {
        observer.next(data);
      });
    });
  }

  onQuestionResult(): Observable<{ correctAnswer: string; scores: any[] }> {
    return new Observable(observer => {
      this.socket.on('question-result', (data: { correctAnswer: string; scores: any[] }) => {
        observer.next(data);
      });
    });
  }

  onGameEnded(): Observable<{ results: any[]; questions: any[] }> {
    return new Observable(observer => {
      this.socket.on('game-ended', (data: { results: any[]; questions: any[] }) => {
        observer.next(data);
      });
    });
  }

  onError(): Observable<{ message: string }> {
    return new Observable(observer => {
      this.socket.on('error', (data: { message: string }) => {
        observer.next(data);
      });
    });
  }

  onPlayerReadyUpdate(): Observable<{ readyCount: number; totalPlayers: number; allReady: boolean }> {
    return new Observable(observer => {
      this.socket.on('player-ready-update', (data: { readyCount: number; totalPlayers: number; allReady: boolean }) => {
        observer.next(data);
      });
    });
  }

  onLiveScores(): Observable<{ scores: any[] }> {
    return new Observable(observer => {
      this.socket.on('live-scores', (data: { scores: any[] }) => {
        observer.next(data);
      });
    });
  }

  getSocket(): Socket {
    return this.socket;
  }

  disconnect(): void {
    this.socket.disconnect();
  }
}

