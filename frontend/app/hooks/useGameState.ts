'use client'

import { useState, useEffect } from 'react';
import { GameState, Difficulty, CellState, Coordinate } from '../types/game';
import { generateBoard, botTurn as easyBotTurn } from '../../actions/functions';
import { generateProbabilitiesForAllShips, generateNextMove } from '../../actions/probability';
import { createMatrix } from '../../actions/helpers';
import { updateLEDsAfterTurn } from '../../actions/connectionTCP';

// Constants
const GRID_SIZE = 10;
const TOTAL_SHIP_SQUARES = 17;

export function useGameState() {
  // Initialize game state
  const [state, setState] = useState<GameState>({
    gameStarted: false,
    difficulty: null,
    humanBoard: [],
    botBoard: [],
    botGrid: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('blue' as CellState)),
    humanHits: 0,
    botHits: 0,
    isHumanTurn: true,
    gameOver: false,
    winner: null,
    humanAttacked: new Set<string>(),
    botAttacked: new Set<string>(),
    botQueue: [],
    boardProbHits: createMatrix(GRID_SIZE, GRID_SIZE, 0),
    boardProbMisses: createMatrix(GRID_SIZE, GRID_SIZE, 0),
  });

  // Destructure state for easier access
  const {
    gameStarted, difficulty, humanBoard, botBoard, botGrid,
    humanHits, botHits, isHumanTurn, gameOver, winner,
    humanAttacked, botAttacked, botQueue, boardProbHits, boardProbMisses
  } = state;

  // Setup game when difficulty is selected
  useEffect(() => {
    if (difficulty) {
      const useHard = difficulty === 'hard';
      const bot = generateBoard(useHard);
      
      // For the human board, try to fetch from the API
      fetch('/api/boardData')
        .then((res) => res.json())
        .then((data) => {
          if (data.board) {
            updateGameState({
              gameStarted: true,
              botBoard: bot,
              humanBoard: data.board,
            });
            console.log('Fetched Human Board:', data.board);
          } else {
            // Fallback to random generation
            const human = generateBoard(useHard);
            updateGameState({
              gameStarted: true,
              botBoard: bot,
              humanBoard: human,
            });
            console.log('Fallback Generated Human Board:', human);
          }
        })
        .catch((err) => {
          console.error('Error fetching human board:', err);
          const human = generateBoard(useHard);
          updateGameState({
            gameStarted: true,
            botBoard: bot,
            humanBoard: human,
          });
          console.log('Fallback Generated Human Board:', human);
        });
      
      console.log('Generated Bot Board:', bot);
    }
  }, [difficulty]);

  // Handle human attack
  const handleHumanAttack = (row: number, col: number) => {
    if (!isHumanTurn || !difficulty || gameOver) return;
    
    const key = `${col},${row}`;
    if (botAttacked.has(key)) {
      console.log(`Cell ${col},${row} already attacked by human.`);
      return;
    }
    
    // Update attacked set
    const newBotAttacked = new Set(botAttacked);
    newBotAttacked.add(key);
    
    // Update grid display
    const newGrid = botGrid.map((r, rIndex) =>
      r.map((cell, cIndex) => {
        if (rIndex === row && cIndex === col) {
          if (botBoard[row][col] === 1 || typeof botBoard[row][col] === 'string') {
            return 'green' as CellState; // Hit
          } else {
            return 'red' as CellState; // Miss
          }
        }
        return cell;
      })
    );
    
    // Check if it's a hit and update counters
    let newHumanHits = humanHits;
    let wasHit = false;
    if (botBoard[row][col] === 1 || typeof botBoard[row][col] === 'string') {
      console.log(`Human attacked ${col},${row} and hit a ship.`);
      newHumanHits = humanHits + 1;
      wasHit = true;
    } else {
      console.log(`Human attacked ${col},${row} and missed.`);
    }
    
    // Check for game over
    const isGameOver = newHumanHits >= TOTAL_SHIP_SQUARES;
    const newWinner = isGameOver ? 'human' as const : winner;
    
    // Update LED display
    updateLEDsAfterTurn(humanBoard, botBoard, humanAttacked, newBotAttacked);
    
    // Update game state
    updateGameState({
      botGrid: newGrid,
      botAttacked: newBotAttacked,
      humanHits: newHumanHits,
      isHumanTurn: wasHit || isGameOver, // Keep turn if it was a hit or game over
      gameOver: isGameOver,
      winner: newWinner
    });
    
    // If game not over and it was a miss, schedule bot's turn
    if (!isGameOver && !wasHit) {
      setTimeout(() => botAttack(), 1000);
    }
  };

  // Bot attack logic
  const botAttack = () => {
    if (gameOver) return;
    
    if (difficulty === 'medium') {
      executeMediumBotStrategy();
    } else if (difficulty === 'hard') {
      executeHardBotStrategy();
    } else {
      executeEasyBotStrategy();
    }
  };

  // Easy bot strategy
  const executeEasyBotStrategy = () => {
    const updatedQueue = easyBotTurn(
      humanBoard,
      humanAttacked,
      botQueue,
      () => {
        const newBotHits = botHits + 1;
        const isGameOver = newBotHits >= TOTAL_SHIP_SQUARES;
        
        updateGameState({
          botHits: newBotHits,
          gameOver: isGameOver,
          winner: isGameOver ? 'bot' : winner
        });
        
        // If the bot hit and game is not over, let bot attack again after a delay
        if (!isGameOver) {
          setTimeout(() => botAttack(), 800);
        }
      }
    );
    
    updateGameState({
      botQueue: updatedQueue,
      isHumanTurn: true // This will only take effect if the bot missed
    });
  };

  // Medium bot strategy
  const executeMediumBotStrategy = () => {
    const probGrid = generateProbabilitiesForAllShips(boardProbHits, boardProbMisses);
    console.log('Probability board (medium):', probGrid);
    const { row: nextRow, col: nextCol } = generateNextMove(probGrid);
    console.log(`Medium bot selecting ${nextCol},${nextRow}`);
    
    const newHumanAttacked = new Set(humanAttacked);
    newHumanAttacked.add(`${nextCol},${nextRow}`);
    
    if (humanBoard[nextRow][nextCol] !== 0) {
      console.log(`Medium bot hit at ${nextCol},${nextRow}`);
      const newBotHits = botHits + 1;
      const isGameOver = newBotHits >= TOTAL_SHIP_SQUARES;
      
      const newProbHits = [...boardProbHits];
      newProbHits[nextRow][nextCol] = 1;
      
      updateGameState({
        humanAttacked: newHumanAttacked,
        boardProbHits: newProbHits,
        botHits: newBotHits,
        gameOver: isGameOver,
        winner: isGameOver ? 'bot' : winner,
        isHumanTurn: isGameOver // Only give turn back if game is over
      });
      
      // If the bot hit and game is not over, let bot attack again after a delay
      if (!isGameOver) {
        setTimeout(() => botAttack(), 800);
      }
    } else {
      console.log(`Medium bot missed at ${nextCol},${nextRow}`);
      const newProbMisses = [...boardProbMisses];
      newProbMisses[nextRow][nextCol] = 1;
      
      updateGameState({
        humanAttacked: newHumanAttacked,
        boardProbMisses: newProbMisses,
        isHumanTurn: true
      });
    }
  };

  // Hard bot strategy
  const executeHardBotStrategy = () => {
    const probGrid = generateProbabilitiesForAllShips(boardProbHits, boardProbMisses);
    console.log('Probability board (hard):', probGrid);
    const { row: nextRow, col: nextCol } = generateNextMove(probGrid);
    console.log(`Hard bot selecting ${nextCol},${nextRow}`);
    
    if (humanBoard[nextRow][nextCol] !== 0) {
      const boatId = humanBoard[nextRow][nextCol];
      console.log(`Hard bot hit boat ${boatId} at ${nextCol},${nextRow}. Uncovering entire boat.`);
      
      let addedHits = 0;
      const newHumanBoard = humanBoard.map(r => [...r]);
      const newProbHits = [...boardProbHits];
      const newHumanAttacked = new Set(humanAttacked);
      
      // Uncover the entire boat
      for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 0; j < GRID_SIZE; j++) {
          if (newHumanBoard[i][j] === boatId) {
            newHumanBoard[i][j] = 0; // mark as hit
            newProbHits[i][j] = 1;
            const cellKey = `${j},${i}`;
            if (!newHumanAttacked.has(cellKey)) {
              newHumanAttacked.add(cellKey);
              addedHits++;
            }
          }
        }
      }
      
      const newBotHits = botHits + addedHits;
      const isGameOver = newBotHits >= TOTAL_SHIP_SQUARES;
      
      updateGameState({
        humanBoard: newHumanBoard,
        humanAttacked: newHumanAttacked,
        boardProbHits: newProbHits,
        botHits: newBotHits,
        gameOver: isGameOver,
        winner: isGameOver ? 'bot' : winner,
        isHumanTurn: isGameOver // Only give turn back if game is over
      });
      
      // If the bot hit and game is not over, let bot attack again after a delay
      if (!isGameOver) {
        setTimeout(() => botAttack(), 800);
      }
    } else {
      console.log(`Hard bot missed at ${nextCol},${nextRow}`);
      const newProbMisses = [...boardProbMisses];
      newProbMisses[nextRow][nextCol] = 1;
      const newHumanAttacked = new Set(humanAttacked);
      newHumanAttacked.add(`${nextCol},${nextRow}`);
      
      updateGameState({
        humanAttacked: newHumanAttacked,
        boardProbMisses: newProbMisses,
        isHumanTurn: true
      });
    }
  };

  // Update specific fields in game state
  const updateGameState = (newState: Partial<GameState>) => {
    setState(currentState => ({
      ...currentState,
      ...newState
    }));
  };

  // Set difficulty and start game
  const selectDifficulty = (newDifficulty: Difficulty) => {
    // Reset game state
    setState({
      ...state,
      gameStarted: false,
      difficulty: newDifficulty,
      botGrid: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('blue' as CellState)),
      humanHits: 0,
      botHits: 0,
      isHumanTurn: true,
      gameOver: false,
      winner: null,
      humanAttacked: new Set<string>(),
      botAttacked: new Set<string>(),
      botQueue: [],
      boardProbHits: createMatrix(GRID_SIZE, GRID_SIZE, 0),
      boardProbMisses: createMatrix(GRID_SIZE, GRID_SIZE, 0),
    });
  };

  // Restart game
  const restartGame = () => {
    setState({
      ...state,
      gameStarted: false,
      difficulty: null,
      botGrid: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('blue' as CellState)),
      humanHits: 0,
      botHits: 0,
      isHumanTurn: true,
      gameOver: false,
      winner: null,
      humanAttacked: new Set<string>(),
      botAttacked: new Set<string>(),
      botQueue: [],
      boardProbHits: createMatrix(GRID_SIZE, GRID_SIZE, 0),
      boardProbMisses: createMatrix(GRID_SIZE, GRID_SIZE, 0),
    });
  };

  return {
    state,
    handleHumanAttack,
    selectDifficulty,
    restartGame
  };
} 