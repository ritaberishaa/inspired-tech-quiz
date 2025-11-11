const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:4200",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Load questions from JSON file
function loadQuestions() {
  try {
    const questionsPath = path.join(__dirname, 'questions.json');
    const questionsData = fs.readFileSync(questionsPath, 'utf8');
    const questions = JSON.parse(questionsData);
    // Shuffle questions for variety
    return shuffleArray([...questions]);
  } catch (error) {
    console.error('Error loading questions:', error);
    return [];
  }
}

// Shuffle array function
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Game state management
const games = new Map();
const MAX_PLAYERS = 5;
const QUESTION_TIME = 20000;
const QUESTIONS_PER_GAME = 10;

// Helper function to normalize answers for comparison
function normalizeAnswer(answer) {
  return answer.toLowerCase().trim();
}

// Helper function to check if answer matches (case-insensitive, partial matching)
function checkAnswer(userAnswer, correctAnswer) {
  const normalizedUser = normalizeAnswer(userAnswer);
  const normalizedCorrect = normalizeAnswer(correctAnswer);
  
  // Check exact match
  if (normalizedUser === normalizedCorrect) {
    return true;
  }
  
  // Check if user answer is contained in correct answer or vice versa
  if (normalizedCorrect.includes(normalizedUser) || normalizedUser.includes(normalizedCorrect)) {
    return true;
  }
  
  // Check word-by-word matching (for cases like "gogh" matching "Vincent van Gogh")
  const correctWords = normalizedCorrect.split(/\s+/);
  const userWords = normalizedUser.split(/\s+/);
  
  // If any word from user answer matches any word from correct answer
  for (const userWord of userWords) {
    if (userWord.length > 2 && correctWords.some(correctWord => 
      correctWord.includes(userWord) || userWord.includes(correctWord)
    )) {
      return true;
    }
  }
  
  return false;
}

// Generate a unique game ID
function generateGameId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-game', () => {
    const gameId = generateGameId();
    const game = {
      id: gameId,
      players: [],
      currentQuestionIndex: 0,
      questions: [], // Will be populated later
      answers: new Map(), // playerId -> array of answers
      answerTimes: new Map(), // playerId -> array of answer times (in ms)
      scores: new Map(), // playerId -> score
      status: 'waiting', // waiting, playing, finished
      questionStartTime: null,
      timer: null,
      readyPlayers: new Set() // Players who clicked "Start"
    };
    
    games.set(gameId, game);
    socket.join(gameId);
    console.log(`Game created: ${gameId}, socket ${socket.id} joined room ${gameId}`);
    socket.emit('game-created', { gameId });
  });

  socket.on('join-game', ({ gameId, playerName }) => {
    const game = games.get(gameId);
    
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    if (game.status !== 'waiting') {
      socket.emit('error', { message: 'Game has already started' });
      return;
    }
    
    if (game.players.length >= MAX_PLAYERS) {
      socket.emit('error', { message: 'Game is full' });
      return;
    }
    
    const player = {
      id: socket.id,
      name: playerName,
      score: 0
    };
    
    game.players.push(player);
    game.answers.set(socket.id, []);
    game.answerTimes.set(socket.id, []);
    game.scores.set(socket.id, 0);
    game.readyPlayers.delete(socket.id); // Reset ready status if rejoining
    
    socket.join(gameId);
    console.log(`${playerName} (${socket.id}) joined game ${gameId}, room members:`, Array.from(io.sockets.adapter.rooms.get(gameId) || []));
    socket.emit('joined-game', { gameId, playerId: socket.id });
    io.to(gameId).emit('player-joined', { 
      players: game.players,
      playerCount: game.players.length,
      readyCount: game.readyPlayers.size
    });
  });

  socket.on('player-ready', ({ gameId }) => {
    const game = games.get(gameId);
    
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    if (game.status !== 'waiting') {
      return;
    }
    
    // Mark player as ready (all players including host)
    game.readyPlayers.add(socket.id);
    
    // Notify all players about ready status
    io.to(gameId).emit('player-ready-update', {
      readyCount: game.readyPlayers.size,
      totalPlayers: game.players.length,
      allReady: game.readyPlayers.size === game.players.length && game.players.length > 0
    });
    
    // If all players are ready, start the game automatically
    if (game.readyPlayers.size === game.players.length && game.players.length > 0) {
      startGame(gameId);
    }
  });

  function startGame(gameId) {
    const game = games.get(gameId);
    
    console.log('startGame function called', { gameId, hasGame: !!game });
    
    if (!game) {
      console.error('Game not found in startGame function');
      return;
    }
    
    // Load questions from JSON file
    const allQuestions = loadQuestions();
    if (allQuestions.length > 0) {
      game.questions = allQuestions.slice(0, QUESTIONS_PER_GAME);
    } else {
      // Fallback to default questions if file not found
      game.questions = Array(QUESTIONS_PER_GAME).fill(null).map((_, i) => ({
        id: i + 1,
        question: `Question ${i + 1} - This is a placeholder question. Replace with your own questions.`,
        answer: `Answer ${i + 1}`
      }));
    }
    
    console.log('Questions loaded', { count: game.questions.length });
    
    game.status = 'playing';
    game.currentQuestionIndex = 0;
    game.readyPlayers.clear();
    
    // Initialize live scores for all players
    const initialScores = game.players.map(player => ({
      playerId: player.id,
      playerName: player.name,
      score: 0
    })).sort((a, b) => b.score - a.score);
    
    console.log('Emitting game-started event', { 
      gameId: gameId, 
      players: game.players.length
    });
    
    const gameStartedData = { 
      question: game.questions[0],
      questionNumber: 1,
      totalQuestions: game.questions.length
    };
    
    // Emit to all sockets in the game room
    io.to(gameId).emit('game-started', gameStartedData);
    
    console.log('game-started event emitted to room', gameId);
    
    // Send initial live scores
    io.to(gameId).emit('live-scores', { scores: initialScores });
    
    // Start first question
    startQuestion(gameId);
  }

  function startQuestion(gameId) {
    const game = games.get(gameId);
    
    if (game.currentQuestionIndex >= game.questions.length) {
      endGame(gameId);
      return;
    }
    
    const question = game.questions[game.currentQuestionIndex];
    game.questionStartTime = Date.now();
    
    // Clear previous answers for this question
    game.answers.forEach((answers, playerId) => {
      answers[game.currentQuestionIndex] = null;
    });
    game.answerTimes.forEach((times, playerId) => {
      times[game.currentQuestionIndex] = null;
    });
    
    io.to(gameId).emit('new-question', {
      question: question,
      questionNumber: game.currentQuestionIndex + 1,
      totalQuestions: game.questions.length,
      timeLeft: QUESTION_TIME / 1000
    });
    
    // Set timer for next question
    game.timer = setTimeout(() => {
      processAnswers(gameId);
      game.currentQuestionIndex++;
      
      if (game.currentQuestionIndex < game.questions.length) {
        setTimeout(() => startQuestion(gameId), 1000); // 1 second break between questions
      } else {
        endGame(gameId);
      }
    }, QUESTION_TIME);
  }

  function processAnswers(gameId) {
    const game = games.get(gameId);
    const question = game.questions[game.currentQuestionIndex];
    const correctAnswer = question.answer;
    
    // Calculate scores based on answer speed
    const correctAnswers = [];
    game.answers.forEach((answers, playerId) => {
      const userAnswer = answers[game.currentQuestionIndex];
      const answerTime = game.answerTimes.get(playerId)?.[game.currentQuestionIndex];
      
      if (userAnswer && checkAnswer(userAnswer, correctAnswer) && answerTime !== null && answerTime !== undefined) {
        correctAnswers.push({
          playerId: playerId,
          time: answerTime
        });
      }
    });
    
    // Sort by time (fastest first)
    correctAnswers.sort((a, b) => a.time - b.time);
    
    // Award points: faster answers get more points
    correctAnswers.forEach((answer, index) => {
      const timeElapsed = answer.time;
      const timeRemaining = QUESTION_TIME - timeElapsed;
      
      // Base points: 1000 for correct answer
      // Speed bonus: up to 1000 points based on how fast (faster = more points)
      // Position bonus: first to answer gets extra 500, second gets 300, third gets 100
      const speedBonus = Math.floor((timeRemaining / QUESTION_TIME) * 1000);
      const positionBonus = index === 0 ? 500 : index === 1 ? 300 : index === 2 ? 100 : 0;
      const points = 1000 + speedBonus + positionBonus;
      
      const currentScore = game.scores.get(answer.playerId) || 0;
      game.scores.set(answer.playerId, currentScore + points);
      
      // Update player score in players array
      const player = game.players.find(p => p.id === answer.playerId);
      if (player) {
        player.score = game.scores.get(answer.playerId);
      }
    });
    
    // Send results for this question with all player scores
    io.to(gameId).emit('question-result', {
      correctAnswer: correctAnswer,
      scores: game.players.map(player => ({
        playerId: player.id,
        playerName: player.name,
        score: game.scores.get(player.id) || 0,
        answeredCorrectly: correctAnswers.some(a => a.playerId === player.id)
      })).sort((a, b) => b.score - a.score)
    });
  }

  function endGame(gameId) {
    const game = games.get(gameId);
    game.status = 'finished';
    
    if (game.timer) {
      clearTimeout(game.timer);
    }
    
    const finalScores = game.players.map(player => ({
      playerId: player.id,
      playerName: player.name,
      score: game.scores.get(player.id) || 0,
      answers: game.answers.get(player.id) || []
    })).sort((a, b) => b.score - a.score);
    
    io.to(gameId).emit('game-ended', {
      results: finalScores,
      questions: game.questions
    });
    
    // Clean up game after 5 minutes
    setTimeout(() => {
      games.delete(gameId);
    }, 300000);
  }

  socket.on('submit-answer', ({ gameId, answer }) => {
    const game = games.get(gameId);
    
    if (!game || game.status !== 'playing') {
      return;
    }
    
    if (!game.answers.has(socket.id)) {
      game.answers.set(socket.id, []);
    }
    if (!game.answerTimes.has(socket.id)) {
      game.answerTimes.set(socket.id, []);
    }
    
    const answers = game.answers.get(socket.id);
    const answerTimes = game.answerTimes.get(socket.id);
    
    // Only record if not already answered (first answer counts)
    if (answers[game.currentQuestionIndex] === null || answers[game.currentQuestionIndex] === undefined) {
      const answerTime = Date.now() - game.questionStartTime;
      answers[game.currentQuestionIndex] = answer;
      answerTimes[game.currentQuestionIndex] = answerTime;
      
      socket.emit('answer-received', { received: true });
      
      // Send live score update to all players
      const currentScores = game.players.map(player => ({
        playerId: player.id,
        playerName: player.name,
        score: game.scores.get(player.id) || 0
      })).sort((a, b) => b.score - a.score);
      
      io.to(gameId).emit('live-scores', { scores: currentScores });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove player from games
    games.forEach((game, gameId) => {
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        game.players.splice(playerIndex, 1);
        io.to(gameId).emit('player-left', { 
          players: game.players,
          playerCount: game.players.length 
        });
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

