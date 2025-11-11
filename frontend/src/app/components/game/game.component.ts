import { Component, OnInit, OnDestroy } from '@angular/core';
import { SocketService } from '../../services/socket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-game',
  template: `
    <div class="card">
      <div class="text-center mb-20">
        <h2>Question {{ currentQuestionNumber }}/{{ totalQuestions }}</h2>
        <div class="timer">{{ timeLeft }}</div>
      </div>

      <div class="question-text text-center">
        <p *ngIf="currentQuestion">{{ currentQuestion.question }}</p>
        <p *ngIf="!currentQuestion" style="color: #999;">Loading question...</p>
      </div>

      <div class="flex flex-column align-center gap-16">
        <input 
          type="text" 
          class="answer-input" 
          placeholder="Type your answer..."
          [(ngModel)]="userAnswer"
          (keyup.enter)="submitAnswer()"
          [disabled]="answerSubmitted || timeLeft === 0"
          #answerInput
        />
        <button 
          class="btn" 
          (click)="submitAnswer()"
          [disabled]="answerSubmitted || !userAnswer || timeLeft === 0"
        >
          {{ answerSubmitted ? 'Answer Submitted ✓' : 'Submit Answer' }}
        </button>
      </div>

      <!-- Live Scores - Always visible during game -->
      <div class="scoreboard mt-20">
        <h3>Live Scores:</h3>
        <div *ngFor="let score of liveScores; let i = index" class="score-item">
          <span>
            <span class="rank-badge" [ngClass]="'rank-' + (i + 1)" *ngIf="i < 3">{{ i + 1 }}</span>
            {{ score.playerName }}
          </span>
          <span><strong>{{ score.score | number:'1.0-0' }} pts</strong></span>
        </div>
      </div>

      <div *ngIf="showResult" class="mt-20" style="background: #f5f5f5; padding: 16px; border-radius: 8px; border-left: 4px solid #000;">
        <h3 style="color: #000; font-weight: bold;">✓ Correct Answer: {{ correctAnswer }}</h3>
      </div>
    </div>
  `,
  styles: []
})
export class GameComponent implements OnInit, OnDestroy {
  currentQuestion: any = null;
  currentQuestionNumber = 0;
  totalQuestions = 10;
  timeLeft = 10;
  userAnswer = '';
  answerSubmitted = false;
  showResult = false;
  correctAnswer = '';
  currentScores: any[] = [];
  liveScores: any[] = [];
  
  private timer: any;
  private subscriptions = new Subscription();
  private gameId = '';

  constructor(private socketService: SocketService) {}

  ngOnInit(): void {
    this.gameId = localStorage.getItem('gameId') || '';
    
    if (!this.gameId) {
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'login' }));
      return;
    }

    // Listen for new questions
    this.subscriptions.add(
      this.socketService.onNewQuestion().subscribe(data => {
        this.currentQuestion = data.question;
        this.currentQuestionNumber = data.questionNumber;
        this.totalQuestions = data.totalQuestions;
        this.timeLeft = Math.floor(data.timeLeft);
        this.userAnswer = '';
        this.answerSubmitted = false;
        this.showResult = false;
        this.startTimer();
      })
    );

    // Listen for live scores (updated when players submit answers and at game start)
    this.subscriptions.add(
      this.socketService.onLiveScores().subscribe(data => {
        if (data.scores && data.scores.length > 0) {
          this.liveScores = data.scores;
        }
      })
    );

    // Listen for question results
    this.subscriptions.add(
      this.socketService.onQuestionResult().subscribe(data => {
        this.correctAnswer = data.correctAnswer;
        this.currentScores = data.scores;
        this.liveScores = data.scores; // Update live scores with final scores for this question
        this.showResult = true;
        this.answerSubmitted = true;
      })
    );

    // Listen for game end
    this.subscriptions.add(
      this.socketService.onGameEnded().subscribe(data => {
        localStorage.setItem('gameResults', JSON.stringify(data.results));
        localStorage.setItem('gameQuestions', JSON.stringify(data.questions));
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'results' }));
      })
    );

    // Also listen for game started (first question)
    this.subscriptions.add(
      this.socketService.onGameStarted().subscribe(data => {
        this.currentQuestion = data.question;
        this.currentQuestionNumber = data.questionNumber;
        this.totalQuestions = data.totalQuestions;
        this.timeLeft = 30; // 30 seconds
        this.startTimer();
      })
    );
  }

  startTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--;
      } else {
        clearInterval(this.timer);
        this.answerSubmitted = true;
      }
    }, 1000);
  }

  submitAnswer(): void {
    if (this.answerSubmitted || !this.userAnswer.trim() || this.timeLeft === 0) {
      return;
    }

    this.socketService.submitAnswer(this.gameId, this.userAnswer).subscribe({
      next: () => {
        this.answerSubmitted = true;
      },
      error: (err) => {
        console.error('Error submitting answer:', err);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.subscriptions.unsubscribe();
  }
}

