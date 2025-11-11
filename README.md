# Inspired Tech Quiz 🎯

A real-time multiplayer quiz application similar to Kahoot, built with Angular and Node.js.

## Features

- 🎮 Real-time multiplayer gameplay (up to 5 players)
- ⏱️ 30-second timer per question
- 📝 10 questions per game
- ✍️ Text-based answers (write the answer)
- 🔍 Smart answer matching (case-insensitive, partial matching)
- 📊 Results tracking and display
- 🎨 Simple and beautiful UI

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Install root dependencies:
```bash
npm install
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
cd ..
```

Or use the convenience script:
```bash
npm run install-all
```

## Running the Application

### Option 1: Run separately

1. Start the backend server:
```bash
npm start
```

2. In a new terminal, start the Angular frontend:
```bash
cd frontend
npm start
```

### Option 2: Run both together (requires concurrently)
```bash
npm run dev
```

The backend will run on `http://localhost:3000`
The frontend will run on `http://localhost:4200`

## How to Play

1. **Create a Game**: Enter your name and click "Create Game"
2. **Share Game ID**: Share the game code with up to 4 other players
3. **Join Game**: Other players enter the game ID and their name
4. **Start Game**: The host clicks "Start Game" when ready
5. **Answer Questions**: Type your answer within 10 seconds
6. **View Results**: See final scores and rankings at the end

## Adding Questions

Questions are automatically loaded from `questions.json` in the root directory. The file contains 200 questions in Albanian. Each game randomly selects 20 questions from this pool.

To add or modify questions, edit the `questions.json` file. The format is:

```json
[
  {
    "id": 1,
    "question": "Cili është kryeqyteti i Francës?",
    "answer": "Paris"
  },
  {
    "id": 2,
    "question": "Sa ditë ka një vit i zakonshëm?",
    "answer": "365"
  }
]
```

The server automatically:
- Loads questions from `questions.json` when a game starts
- Randomly shuffles and selects 20 questions per game
- Falls back to placeholder questions if the file is not found

## Answer Matching

The app uses intelligent answer matching:
- Case-insensitive (e.g., "paris" matches "Paris")
- Partial matching (e.g., "gogh" matches "Vincent van Gogh")
- Word-based matching for complex answers

## Project Structure

```
.
├── server.js              # Backend server with Socket.io
├── package.json           # Backend dependencies
├── questions.json         # Quiz questions (200 questions in Albanian)
├── questions-example.json # Example questions file
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── login/        # Login component
│   │   │   │   ├── game-room/    # Game room component
│   │   │   │   ├── game/         # Game component
│   │   │   │   └── results/      # Results component
│   │   │   ├── services/
│   │   │   │   └── socket.service.ts  # Socket.io service
│   │   │   └── app.component.ts
│   │   ├── styles.css
│   │   └── index.html
│   └── package.json       # Frontend dependencies
└── README.md
```

## Technologies Used

- **Frontend**: Angular 16
- **Backend**: Node.js, Express
- **Real-time**: Socket.io
- **Styling**: CSS with modern gradients and animations

## License

MIT

