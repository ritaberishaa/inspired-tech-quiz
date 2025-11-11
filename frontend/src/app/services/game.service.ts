import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import questionsData from '../../assets/questions.json';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private questions: any[] = [];
  private currentQuestionIndex = 0;
  private gameQuestions: any[] = [];
  private playerName = '';
  private score = 0;
  private answers: string[] = [];
  private answerTimes: number[] = [];
  private questionStartTime = 0;
  
  private questionSubject = new Subject<any>();
  private scoreSubject = new BehaviorSubject<any[]>([]);
  private gameEndedSubject = new Subject<any>();

  constructor() {
    this.questions = questionsData;
  }

  // Normalize answer for comparison
  private normalizeAnswer(answer: string): string {
    return answer.toLowerCase().trim();
  }

  // Check if answer matches (case-insensitive, partial matching)
  private checkAnswer(userAnswer: string, correctAnswer: string): boolean {
    const normalizedUser = this.normalizeAnswer(userAnswer);
    const normalizedCorrect = this.normalizeAnswer(correctAnswer);
    
    // Exact match
    if (normalizedUser === normalizedCorrect) {
      return true;
    }
    
    // Check if user answer contains any word from correct answer
    const correctWords = normalizedCorrect.split(/\s+/);
    const userWords = normalizedUser.split(/\s+/);
    
    // Check if all words in user answer are found in correct answer
    for (const userWord of userWords) {
      if (userWord.length > 2) { // Only check words longer than 2 characters
        let found = false;
        for (const correctWord of correctWords) {
          if (correctWord.includes(userWord) || userWord.includes(correctWord)) {
            found = true;
            break;
          }
        }
        if (!found) {
          return false;
        }
      }
    }
    
    // Check if correct answer contains user answer (partial match)
    if (normalizedCorrect.includes(normalizedUser) && normalizedUser.length >= 3) {
      return true;
    }
    
    return false;
  }

  // Shuffle array
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Start game
  startGame(playerName: string): void {
    this.playerName = playerName;
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.answers = [];
    this.answerTimes = [];
    
    // Select 10 random questions
    const shuffled = this.shuffleArray(this.questions);
    this.gameQuestions = shuffled.slice(0, 10);
    
    // Start first question
    this.startQuestion();
  }

  // Start a question
  private startQuestion(): void {
    if (this.currentQuestionIndex >= this.gameQuestions.length) {
      this.endGame();
      return;
    }

    const question = this.gameQuestions[this.currentQuestionIndex];
    this.questionStartTime = Date.now();
    
    this.questionSubject.next({
      question: question,
      questionNumber: this.currentQuestionIndex + 1,
      totalQuestions: this.gameQuestions.length,
      timeLeft: 20 // 20 seconds
    });

    // Update score display
    this.updateScoreDisplay();
  }

  // Submit answer
  submitAnswer(answer: string): void {
    if (this.answers[this.currentQuestionIndex] !== undefined) {
      return; // Already answered
    }

    const answerTime = Date.now() - this.questionStartTime;
    this.answers[this.currentQuestionIndex] = answer;
    this.answerTimes[this.currentQuestionIndex] = answerTime;

    // Check answer
    const question = this.gameQuestions[this.currentQuestionIndex];
    const isCorrect = this.checkAnswer(answer, question.answer);

    if (isCorrect) {
      // Calculate score based on speed (faster = more points)
      const maxTime = 20000; // 20 seconds
      const timeRatio = 1 - (answerTime / maxTime);
      const baseScore = 1000;
      const timeBonus = Math.floor(timeRatio * 500);
      const questionScore = baseScore + timeBonus;
      
      this.score += questionScore;
    }

    // Update score display
    this.updateScoreDisplay();
  }

  // Update score display
  private updateScoreDisplay(): void {
    this.scoreSubject.next([{
      playerId: 'player',
      playerName: this.playerName,
      score: this.score
    }]);
  }

  // Process question result (after timer ends)
  processQuestionResult(): void {
    const question = this.gameQuestions[this.currentQuestionIndex];
    const userAnswer = this.answers[this.currentQuestionIndex] || '';
    const isCorrect = this.checkAnswer(userAnswer, question.answer);

    // Move to next question after 2 seconds
    setTimeout(() => {
      this.currentQuestionIndex++;
      this.startQuestion();
    }, 2000);
  }

  // End game
  private endGame(): void {
    const results = [{
      playerId: 'player',
      playerName: this.playerName,
      score: this.score
    }];

    this.gameEndedSubject.next({
      results: results,
      questions: this.gameQuestions
    });
  }

  // Observables
  onNewQuestion(): Observable<any> {
    return this.questionSubject.asObservable();
  }

  onLiveScores(): Observable<any[]> {
    return this.scoreSubject.asObservable();
  }

  onGameEnded(): Observable<any> {
    return this.gameEndedSubject.asObservable();
  }

  // Get current question
  getCurrentQuestion(): any {
    if (this.currentQuestionIndex < this.gameQuestions.length) {
      return this.gameQuestions[this.currentQuestionIndex];
    }
    return null;
  }

  // Get correct answer for current question
  getCorrectAnswer(): string {
    const question = this.getCurrentQuestion();
    return question ? question.answer : '';
  }
}

