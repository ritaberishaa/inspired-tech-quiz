import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, update, remove, get, child, Database } from 'firebase/database';
import { Observable, BehaviorSubject, Subject, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FirebaseGameService {
  private database: Database;
  private playerId: string = '';
  private gameId: string = '';
  private questions: any[] = [];

  private questionSubject = new Subject<any>();
  private scoreSubject = new BehaviorSubject<any[]>([]);
  private gameEndedSubject = new Subject<any>();
  private playerJoinedSubject = new Subject<any>();
  private playerLeftSubject = new Subject<any>();
  private playerReadyUpdateSubject = new Subject<any>();

  constructor(private http: HttpClient) {
    const app = initializeApp(environment.firebase);
    this.database = getDatabase(app);
    this.playerId = this.generatePlayerId();
    this.loadQuestions();
  }

  private async loadQuestions(): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get<any[]>('/assets/questions.json'));
      this.questions = data;
      console.log(`Loaded ${this.questions.length} questions`);
    } catch (error) {
      console.error('Error loading questions:', error);
      this.questions = [];
    }
  }

  private generatePlayerId(): string {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
  }

  private generateGameId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
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
      if (userWord.length > 2) {
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

  // Create game
  createGame(): Observable<{ gameId: string }> {
    return new Observable(observer => {
      // Wait for questions to load if not loaded yet
      if (this.questions.length === 0) {
        const checkQuestions = setInterval(() => {
          if (this.questions.length > 0) {
            clearInterval(checkQuestions);
            this.createGame().subscribe(observer);
          }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkQuestions);
          if (this.questions.length === 0) {
            observer.error({ message: 'Failed to load questions. Please refresh the page.' });
          }
        }, 5000);
        return;
      }
      
      const gameId = this.generateGameId();
      this.gameId = gameId;
      
      const gameRef = ref(this.database, `games/${gameId}`);
      
      const shuffled = this.shuffleArray(this.questions);
      const gameQuestions = shuffled.slice(0, 10);
      
      const gameData = {
        id: gameId,
        players: [],
        currentQuestionIndex: 0,
        questions: gameQuestions,
        status: 'waiting',
        questionStartTime: null,
        readyPlayers: {},
        createdAt: Date.now()
      };
      
      set(gameRef, gameData).then(() => {
        observer.next({ gameId });
        observer.complete();
      }).catch(err => {
        observer.error(err);
      });
    });
  }

  // Join game
  joinGame(gameId: string, playerName: string): Observable<{ gameId: string; playerId: string }> {
    return new Observable(observer => {
      this.gameId = gameId.toUpperCase();
      const gameRef = ref(this.database, `games/${this.gameId}`);
      
      get(gameRef).then((snapshot) => {
        if (!snapshot.exists()) {
          observer.error({ message: 'Game not found' });
          return;
        }
        
        const game = snapshot.val();
        if (game.status !== 'waiting') {
          observer.error({ message: 'Game already started' });
          return;
        }
        
        if (game.players && game.players.length >= 5) {
          observer.error({ message: 'Game is full' });
          return;
        }
        
        // Add player
        const players = game.players || [];
        const player = {
          id: this.playerId,
          name: playerName
        };
        players.push(player);
        
        update(gameRef, { players }).then(() => {
          // Listen to game changes
          this.setupGameListeners();
          
          observer.next({ gameId: this.gameId, playerId: this.playerId });
          observer.complete();
        }).catch(err => {
          observer.error(err);
        });
      }).catch(err => {
        observer.error(err);
      });
    });
  }

  // Setup game listeners
  private setupGameListeners(): void {
    const gameRef = ref(this.database, `games/${this.gameId}`);
    
    onValue(gameRef, (snapshot) => {
      if (!snapshot.exists()) return;
      
      const game = snapshot.val();
      
      // Emit player joined/left updates
      this.playerJoinedSubject.next({
        players: game.players || [],
        playerCount: (game.players || []).length,
        readyCount: Object.keys(game.readyPlayers || {}).length
      });
      
      // Emit ready updates
      this.playerReadyUpdateSubject.next({
        readyCount: Object.keys(game.readyPlayers || {}).length,
        totalPlayers: (game.players || []).length,
        allReady: Object.keys(game.readyPlayers || {}).length === (game.players || []).length && (game.players || []).length > 0
      });
      
      // Handle game started
      if (game.status === 'playing' && game.currentQuestionIndex !== undefined) {
        const questionIndex = game.currentQuestionIndex;
        if (questionIndex < game.questions.length) {
          const question = game.questions[questionIndex];
          const timeLeft = game.questionStartTime ? Math.max(0, 20 - Math.floor((Date.now() - game.questionStartTime) / 1000)) : 20;
          
          this.questionSubject.next({
            question: question,
            questionNumber: questionIndex + 1,
            totalQuestions: game.questions.length,
            timeLeft: timeLeft
          });
        }
      }
      
      // Handle question results
      if (game.status === 'playing' && game.lastQuestionResult) {
        const questionIndex = game.currentQuestionIndex - 1;
        if (questionIndex >= 0 && questionIndex < game.questions.length) {
          const question = game.questions[questionIndex];
          const scores = game.scores ? Object.keys(game.scores).map(playerId => ({
            playerId: playerId,
            playerName: (game.players || []).find((p: any) => p.id === playerId)?.name || 'Unknown',
            score: game.scores[playerId] || 0
          })).sort((a: any, b: any) => b.score - a.score) : [];
          
          // Emit result (will be handled by component)
          setTimeout(() => {
            this.scoreSubject.next(scores);
          }, 100);
        }
      }
      
      // Handle game ended
      if (game.status === 'finished') {
        const results = game.scores ? Object.keys(game.scores).map(playerId => ({
          playerId: playerId,
          playerName: (game.players || []).find((p: any) => p.id === playerId)?.name || 'Unknown',
          score: game.scores[playerId] || 0
        })).sort((a: any, b: any) => b.score - a.score) : [];
        
        this.gameEndedSubject.next({
          results: results,
          questions: game.questions || []
        });
      }
      
      // Update live scores
      if (game.scores) {
        const scores = Object.keys(game.scores).map(playerId => ({
          playerId: playerId,
          playerName: (game.players || []).find((p: any) => p.id === playerId)?.name || 'Unknown',
          score: game.scores[playerId] || 0
        })).sort((a: any, b: any) => b.score - a.score);
        
        this.scoreSubject.next(scores);
      }
    });
  }

  // Player ready
  playerReady(gameId: string): void {
    const gameRef = ref(this.database, `games/${gameId}`);
    
    get(gameRef).then((snapshot) => {
      if (!snapshot.exists()) return;
      
      const game = snapshot.val();
      const readyPlayers = game.readyPlayers || {};
      readyPlayers[this.playerId] = true;
      
      update(gameRef, { readyPlayers }).then(() => {
        // Check if all players are ready
        const allReady = Object.keys(readyPlayers).length === (game.players || []).length && (game.players || []).length > 0;
        
        if (allReady && game.status === 'waiting') {
          // Start game
          this.startGame(gameId);
        }
      });
    });
  }

  // Start game
  private startGame(gameId: string): void {
    const gameRef = ref(this.database, `games/${gameId}`);
    
    get(gameRef).then((snapshot) => {
      if (!snapshot.exists()) return;
      
      const game = snapshot.val();
      
      // Initialize game state
      const gameData: any = {
        status: 'playing',
        currentQuestionIndex: 0,
        questionStartTime: Date.now(),
        answers: {},
        answerTimes: {},
        scores: {},
        lastQuestionResult: null
      };
      
      // Initialize scores for all players
      (game.players || []).forEach((player: any) => {
        gameData.scores[player.id] = 0;
      });
      
      update(gameRef, gameData).then(() => {
        // Start first question
        this.processQuestion(gameId, 0);
      });
    });
  }

  // Process question
  private processQuestion(gameId: string, questionIndex: number): void {
    const gameRef = ref(this.database, `games/${gameId}`);
    
    get(gameRef).then((snapshot) => {
      if (!snapshot.exists()) return;
      
      const game = snapshot.val();
      
      if (questionIndex >= game.questions.length) {
        // End game
        update(gameRef, { status: 'finished' });
        return;
      }
      
      // Set current question
      update(gameRef, {
        currentQuestionIndex: questionIndex,
        questionStartTime: Date.now(),
        lastQuestionResult: null
      });
      
      // After 20 seconds, process answers
      setTimeout(() => {
        this.processAnswers(gameId, questionIndex);
      }, 20000);
    });
  }

  // Process answers
  private processAnswers(gameId: string, questionIndex: number): void {
    const gameRef = ref(this.database, `games/${gameId}`);
    
    get(gameRef).then((snapshot) => {
      if (!snapshot.exists()) return;
      
      const game = snapshot.val();
      const question = game.questions[questionIndex];
      const answers = game.answers || {};
      const answerTimes = game.answerTimes || {};
      const scores = game.scores || {};
      
      // Process each player's answer
      Object.keys(answers).forEach(playerId => {
        const playerAnswers = answers[playerId] || [];
        const playerAnswerTimes = answerTimes[playerId] || [];
        
        if (playerAnswers[questionIndex] !== undefined) {
          const userAnswer = playerAnswers[questionIndex];
          const answerTime = playerAnswerTimes[questionIndex] || 20000;
          const isCorrect = this.checkAnswer(userAnswer, question.answer);
          
          if (isCorrect) {
            const maxTime = 20000;
            const timeRatio = 1 - (answerTime / maxTime);
            const baseScore = 1000;
            const timeBonus = Math.floor(timeRatio * 500);
            const questionScore = baseScore + timeBonus;
            
            scores[playerId] = (scores[playerId] || 0) + questionScore;
          }
        }
      });
      
      // Update game state
      update(gameRef, {
        scores: scores,
        lastQuestionResult: {
          correctAnswer: question.answer,
          scores: Object.keys(scores).map(playerId => ({
            playerId: playerId,
            playerName: (game.players || []).find((p: any) => p.id === playerId)?.name || 'Unknown',
            score: scores[playerId] || 0
          })).sort((a: any, b: any) => b.score - a.score)
        }
      }).then(() => {
        // Move to next question after 2 seconds
        setTimeout(() => {
          this.processQuestion(gameId, questionIndex + 1);
        }, 2000);
      });
    });
  }

  // Submit answer
  submitAnswer(gameId: string, answer: string): Observable<{ received: boolean }> {
    return new Observable(observer => {
      const gameRef = ref(this.database, `games/${gameId}`);
      
      get(gameRef).then((snapshot) => {
        if (!snapshot.exists()) {
          observer.error({ message: 'Game not found' });
          return;
        }
        
        const game = snapshot.val();
        if (game.status !== 'playing') {
          observer.error({ message: 'Game not in progress' });
          return;
        }
        
        const answers = game.answers || {};
        const answerTimes = game.answerTimes || {};
        
        if (!answers[this.playerId]) {
          answers[this.playerId] = [];
        }
        if (!answerTimes[this.playerId]) {
          answerTimes[this.playerId] = [];
        }
        
        const questionIndex = game.currentQuestionIndex;
        
        // Only record first answer
        if (answers[this.playerId][questionIndex] === undefined) {
          const answerTime = Date.now() - game.questionStartTime;
          answers[this.playerId][questionIndex] = answer;
          answerTimes[this.playerId][questionIndex] = answerTime;
          
          update(gameRef, { answers, answerTimes }).then(() => {
            observer.next({ received: true });
            observer.complete();
          }).catch(err => {
            observer.error(err);
          });
        } else {
          observer.next({ received: true });
          observer.complete();
        }
      }).catch(err => {
        observer.error(err);
      });
    });
  }

  // Observables
  onPlayerJoined(): Observable<any> {
    return this.playerJoinedSubject.asObservable();
  }

  onPlayerLeft(): Observable<any> {
    return this.playerLeftSubject.asObservable();
  }

  onGameStarted(): Observable<any> {
    return this.questionSubject.asObservable();
  }

  onNewQuestion(): Observable<any> {
    return this.questionSubject.asObservable();
  }

  onQuestionResult(): Observable<any> {
    return new Observable(observer => {
      const gameRef = ref(this.database, `games/${this.gameId}`);
      
      onValue(gameRef, (snapshot) => {
        if (!snapshot.exists()) return;
        
        const game = snapshot.val();
        if (game.status === 'playing' && game.lastQuestionResult) {
          observer.next({
            correctAnswer: game.lastQuestionResult.correctAnswer,
            scores: game.lastQuestionResult.scores
          });
        }
      });
    });
  }

  onLiveScores(): Observable<any[]> {
    return this.scoreSubject.asObservable();
  }

  onGameEnded(): Observable<any> {
    return this.gameEndedSubject.asObservable();
  }

  onPlayerReadyUpdate(): Observable<any> {
    return this.playerReadyUpdateSubject.asObservable();
  }

  onError(): Observable<any> {
    return new Observable(observer => {
      // Handle errors if needed
    });
  }

  getPlayerId(): string {
    return this.playerId;
  }

  disconnect(): void {
    // Clean up if needed
  }
}

