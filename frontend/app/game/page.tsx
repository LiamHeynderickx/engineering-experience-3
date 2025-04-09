"use client";
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import GameBoard from '../components/GameBoard';
import GameControls from '../components/GameControls';
import CameraCapture from '../components/CameraCapture';
import VoiceRecognition from '../components/VoiceRecognition';
import { useGameState } from '../hooks/useGameState';
import { useCameraState } from '../hooks/useCameraState';
import { CellState } from '../types/game';
import ShipStatus from '../components/ShipStatus';

// We don't need to redefine Speech Recognition types here since they are already defined 
// in the VoiceRecognition.tsx component

// Define the Ship interface to match our SHIP_DEFINITIONS
interface Ship {
  id: string;
  name: string;
  length: number;
  hits: number;
}

// Ship definitions (one of each type)
const SHIP_DEFINITIONS: Ship[] = [
  { id: "5", name: "Carrier", length: 5, hits: 0 },
  { id: "4", name: "Battleship", length: 4, hits: 0 },
  { id: "3a", name: "Cruiser", length: 3, hits: 0 },
  { id: "3b", name: "Submarine", length: 3, hits: 0 },
  { id: "2", name: "Destroyer", length: 2, hits: 0 }
];

// Function to count hits on each ship
function countShipHits(board: (string | number)[][], attackedSquares: Set<string>): Record<string | number, number> {
  const hits: Record<string | number, number> = {};
  
  // Initialize hit counts
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      const shipId = board[r][c];
      if (shipId !== 0 && !hits[shipId]) {
        hits[shipId] = 0;
      }
    }
  }
  
  // Count hits
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      const key = `${c},${r}`;
      if (attackedSquares.has(key)) {
        const shipId = board[r][c];
        if (shipId !== 0) {
          hits[shipId] = (hits[shipId] || 0) + 1;
        }
      }
    }
  }
  
  return hits;
}

// Check which ships are sunk based on hits
const checkSunkShips = (board: (string | number)[][], attackedCoords: Set<string>) => {
  const sunkShips = new Set<string | number>();
  
  // For each ship ID, check if all cells of that ship have been hit
  // First, create a map of ship IDs to their total length
  const shipLengths: Record<string, number> = {};
  const shipHits: Record<string, number> = {};
  
  // Count the total cells for each ship
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const shipId = board[row][col];
      if (shipId !== 0 && shipId !== '') {
        const shipIdStr = shipId.toString();
        shipLengths[shipIdStr] = (shipLengths[shipIdStr] || 0) + 1;
      }
    }
  }
  
  // Count how many cells of each ship have been hit
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const key = `${col},${row}`;
      const shipId = board[row][col];
      if (shipId !== 0 && shipId !== '' && attackedCoords.has(key)) {
        const shipIdStr = shipId.toString();
        shipHits[shipIdStr] = (shipHits[shipIdStr] || 0) + 1;
      }
    }
  }
  
  // Check which ships are fully sunk
  for (const shipId in shipLengths) {
    // If all cells of the ship have been hit, the ship is sunk
    if (shipHits[shipId] && shipHits[shipId] === shipLengths[shipId]) {
      sunkShips.add(shipId);
    }
  }
  
  return sunkShips;
};

// Helper function to identify which ship was newly sunk
const checkForNewlySunkShips = (oldSunkShips: Set<string | number>, newSunkShips: Set<string | number>) => {
  // Find the newly sunk ship ID
  for (const shipId of Array.from(newSunkShips)) {
    if (!oldSunkShips.has(shipId)) {
      // Find the ship name from SHIP_DEFINITIONS based on ID
      const shipName = SHIP_DEFINITIONS.find(ship => ship.id.toString() === shipId.toString())?.name || "Unknown Ship";
      return shipName;
    }
  }
  return null;
};

const GamePage = () => {
  // Game state management
  const { 
    state: gameState, 
    handleHumanAttack, 
    selectDifficulty, 
    restartGame 
  } = useGameState();
  
  // Camera state management
  const {
    cameraState,
    setCameraImage,
    setImageConfirmed,
    setUseTestImage,
    captureImage,
    resetCameraState
  } = useCameraState();

  // Voice recognition states
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [voiceCellCoord, setVoiceCellCoord] = useState<string | null>(null);

  // For visual animation effects
  const [lastHit, setLastHit] = useState({ row: -1, col: -1 });
  
  // Track sunk enemy ships
  const [sunkEnemyShips, setSunkEnemyShips] = useState<Set<string | number>>(new Set());
  const [sunkShipNotification, setSunkShipNotification] = useState<string | null>(null);
  
  // Counter to force updates when sunk ships change
  const [boardUpdateCounter, setBoardUpdateCounter] = useState(0);
  
  // Handle voice recognition results
  const handleVoiceResult = (transcript: string) => {
    setVoiceMessage(`You said: "${transcript}"`);
    
    // Try to parse cell coordinates from the transcript
    const parsedCoord = parseCoordinateFromVoice(transcript);
    if (parsedCoord) {
      setVoiceCellCoord(parsedCoord);
      // Auto-fire at the recognized coordinate
      const [colLetter, ...rowDigits] = parsedCoord.split('');
      const col = colLetter.charCodeAt(0) - 'A'.charCodeAt(0);
      const row = parseInt(rowDigits.join(''), 10) - 1;
      
      // Validate coordinates
      if (col >= 0 && col < 10 && row >= 0 && row < 10) {
        handleBoardAttack(row, col);
      }
          } else {
      setVoiceMessage(`Could not identify a valid coordinate in "${transcript}"`);
    }
  };
  
  // Handle voice recognition errors
  const handleVoiceError = (error: string) => {
    setVoiceMessage(error);
    setVoiceCellCoord(null);
  };
  
  // Parse coordinates from voice input (e.g., "A5", "attack B3")
  const parseCoordinateFromVoice = (transcript: string): string | null => {
    // Normalize and clean the input
    let input = transcript.toLowerCase().trim();
    
    // VERY STRICT check - input must contain exactly 2-3 characters of valid format
    // Direct match for common patterns like "a5", "b10", etc.
    const strictMatch = input.match(/^([a-j])(\d|10)$/i);
    if (strictMatch) {
      const column = strictMatch[1].toUpperCase();
      const row = strictMatch[2];
      return `${column}${row}`;
    }
    
    // NATO phonetic alphabet mappings - only include the exact letter mappings
    const natoAlphabet: Record<string, string> = {
      'alpha': 'a', 'bravo': 'b', 'charlie': 'c', 'delta': 'd',
      'echo': 'e', 'foxtrot': 'f', 'golf': 'g', 'hotel': 'h',
      'india': 'i', 'juliet': 'j'
    };
    
    // Process the input - replace NATO words with letters
    Object.entries(natoAlphabet).forEach(([word, letter]) => {
      const wordRegex = new RegExp(`^${word}\\b`, 'i');
      if (input.match(wordRegex)) {
        input = input.replace(wordRegex, letter);
      }
    });
    
    // Check for patterns like "a 5" - letter space number
    const spaceMatch = input.match(/^([a-j])\s+(\d|10)$/i);
    if (spaceMatch) {
      const column = spaceMatch[1].toUpperCase();
      const row = spaceMatch[2];
      return `${column}${row}`;
    }
    
    // Extract only the first letter and first number if they exist
    const letterMatch = input.match(/\b([a-j])\b/i);
    const numberMatch = input.match(/\b([1-9]|10)\b/);
    
    if (letterMatch && numberMatch) {
      // Only accept if these are the major components of the input
      // Calculate how much of the input these matches cover
      const letter = letterMatch[0];
      const number = numberMatch[0];
      const combinedLength = letter.length + number.length;
      const inputWithoutSpaces = input.replace(/\s+/g, '');
      
      // If these components make up at least 70% of the input (ignoring spaces)
      if (combinedLength >= inputWithoutSpaces.length * 0.7) {
        const column = letter.toUpperCase();
        const row = number;
        return `${column}${row}`;
      }
    }
    
    return null;
  };

  // Wrapper for attack handler that tracks last hit for animation
  const handleBoardAttack = (row: number, col: number) => {
    const key = `${col},${row}`;
    
    // Check if this cell has already been attacked
    if (gameState.botAttacked.has(key)) {
      // Cell was already attacked, don't do anything
      setVoiceMessage(`Cell ${String.fromCharCode(65 + col)}${row + 1} already attacked`);
      return;
    }
    
    // Cell hasn't been attacked yet, proceed with attack
    setLastHit({ row, col });
    handleHumanAttack(row, col);
    
    if (voiceCellCoord) {
      setVoiceMessage(`Attacking ${voiceCellCoord}`);
    }
  };

  // Game start effect - when image is confirmed and difficulty is selected
  useEffect(() => {
    if (cameraState.imageConfirmed && gameState.difficulty) {
      // Game is starting
    }
  }, [cameraState.imageConfirmed, gameState.difficulty]);

  // Reset camera state when restarting game
  useEffect(() => {
    if (!gameState.gameStarted && !gameState.difficulty) {
      resetCameraState();
    }
  }, [gameState.gameStarted, gameState.difficulty]);

  // Update sunken ships after each attack
  useEffect(() => {
    // This ensures proper re-rendering when a ship is sunk
    if (gameState.gameStarted && gameState.botBoard.length > 0) {
      const oldSunkShips = new Set(sunkEnemyShips);
      // Check for newly sunk ships with each attack
      const newSunkShips = checkSunkShips(gameState.botBoard, gameState.botAttacked);
      
      // Check if any new ships were sunk
      if (newSunkShips.size > oldSunkShips.size) {
        const newlySunkShip = checkForNewlySunkShips(oldSunkShips, newSunkShips);
        if (newlySunkShip) {
          // Show a notification
          setSunkShipNotification(`You sunk the enemy's ${newlySunkShip}!`);
          
          // Hide notification after 3 seconds
          setTimeout(() => {
            setSunkShipNotification(null);
          }, 3000);
          
          // Force a board update
          setBoardUpdateCounter(prev => prev + 1);
        }
      }
      
      // Ensure the sunk ships state is updated
      setSunkEnemyShips(newSunkShips);
    }
  }, [gameState.botAttacked, gameState.botBoard]);

  return (
    <div className="game-container bg-gradient-to-b from-blue-50 to-gray-100 min-h-screen">
      <h1 className="game-title">Battleship Game</h1>
      
      {/* Before game start - Camera and difficulty selection */}
      {!gameState.gameStarted && (
        <div className="flex flex-col items-center">
          {/* Camera section */}
          <div className="max-w-md w-full mb-8">
            <div className="card">
              <div className="card-header">
                Game Setup
              </div>
              <div className="card-body">
                <CameraCapture 
                  cameraState={cameraState}
                  setCameraImage={setCameraImage}
                  setImageConfirmed={setImageConfirmed}
                  setUseTestImage={setUseTestImage}
                  onCapture={captureImage}
                />
              </div>
            </div>
          </div>
          
          {/* Game control buttons */}
          <div className="max-w-md w-full">
            <GameControls
              gameStarted={gameState.gameStarted}
              difficulty={gameState.difficulty}
              winner={gameState.winner}
              humanHits={gameState.humanHits}
              botHits={gameState.botHits}
              onSelectDifficulty={selectDifficulty}
              onRestart={restartGame}
            />
          </div>
          
          {/* Rules link */}
          <Link href="/rules" className="mt-6 btn btn-secondary">
            View Game Rules
          </Link>
        </div>
      )}
      
      {/* Game in progress */}
      {gameState.gameStarted && (
        <div className="max-w-7xl mx-auto px-4">
          {/* Game status message */}
          {!gameState.gameOver && (
            <div className={`text-center mb-6 p-4 rounded-lg shadow-lg border-2 ${
              gameState.isHumanTurn 
                ? "bg-blue-100 border-blue-500" 
                : "bg-red-100 border-red-500"
            }`}>
              <p className={`text-xl font-bold ${
                gameState.isHumanTurn ? "text-blue-800" : "text-red-800"
              }`}>
                {gameState.isHumanTurn 
                  ? "YOUR TURN - Click on the enemy's board to attack!" 
                  : "OPPONENT'S TURN - Bot is launching an attack..."}
              </p>
              <p className="mt-2 text-gray-700">
                {gameState.isHumanTurn 
                  ? "Target the enemy ships by clicking on their board" 
                  : "Please wait while the opponent makes their move"}
              </p>
              
              {/* Voice recognition UI */}
              {gameState.isHumanTurn && (
                <div className="mt-3 flex flex-col items-center">
                  <VoiceRecognition 
                    onResult={handleVoiceResult}
                    onError={handleVoiceError}
                    isEnabled={gameState.isHumanTurn}
                  />
                  
                  {voiceMessage && (
                    <div className="mt-2 text-sm px-3 py-1 bg-gray-100 rounded-full">
                      {voiceMessage}
                    </div>
                  )}
            </div>
          )}
        </div>
          )}
          
          {/* Victory/defeat message */}
          {gameState.gameOver && (
            <div className="text-center mb-6 fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 rounded-lg shadow-2xl transform transition-all">
                <h3 className="text-3xl font-bold mb-4 text-white drop-shadow">
                  {gameState.winner === 'human' ? 'Victory!' : 'Defeated!'}
                </h3>
            <button
                  className="px-6 py-3 bg-white text-gray-900 rounded hover:bg-gray-100 font-bold text-lg w-full"
                  onClick={restartGame}
                >
                  Play Again
            </button>
              </div>
            </div>
          )}
          
          {/* Sunk ship notification */}
          {sunkShipNotification && (
            <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce">
              <span className="text-lg font-bold">{sunkShipNotification}</span>
            </div>
          )}
          
          {/* Battle area - Improved layout with proper spacing */}
          <div className="flex flex-col justify-center">
            {/* Game boards */}
            <div className="flex flex-col md:flex-row gap-6 justify-center">
              {/* Bot board - Enemy Waters */}
              <div className={`w-full md:w-1/2 transition-all duration-300 ${gameState.isHumanTurn ? "scale-105 shadow-lg" : "opacity-90"}`}>
                <div className={`rounded-lg p-1 ${gameState.isHumanTurn ? "bg-blue-200 ring-4 ring-blue-500" : ""}`}>
                  <GameBoard
                    key={`bot-board-${boardUpdateCounter}`}
                    grid={gameState.botGrid.map(row => row.map(cell => cell as CellState))}
                    onCellClick={handleBoardAttack}
                    disabled={!gameState.isHumanTurn || gameState.gameOver}
                    title="Enemy Waters"
                    board={gameState.botBoard}
                    attackedCells={gameState.botAttacked}
                    showShips={gameState.gameOver}
                    sunkShips={sunkEnemyShips}
                  />
                  
                  {/* Highlight recognized cell from voice */}
                  {voiceCellCoord && gameState.isHumanTurn && (
                    <div className="mt-2 text-center text-blue-700 font-medium animate-pulse">
                      Targeting: {voiceCellCoord}
                    </div>
          )}
        </div>
      </div>
              
              {/* Human board - Your Waters */}
              <div className={`w-full md:w-1/2 transition-all duration-300 ${!gameState.isHumanTurn ? "scale-105 shadow-lg" : "opacity-90"}`}>
                <div className={`rounded-lg p-1 ${!gameState.isHumanTurn ? "bg-red-200 ring-4 ring-red-500" : ""}`}>
                  <GameBoard
                    grid={gameState.humanBoard.map((row, r) => 
                      row.map((cell, c) => {
                        const key = `${c},${r}`;
                        if (gameState.humanAttacked.has(key)) {
                          return cell.toString() !== '0' ? 'green' as CellState : 'red' as CellState;
                        }
                        return 'blue' as CellState;
                      })
                    )}
                    onCellClick={() => {}} // No clicking on your own board
                    disabled={true}
                    title="Your Waters"
                    board={gameState.humanBoard}
                    attackedCells={gameState.humanAttacked}
                    showShips={true}
                  />
                </div>
              </div>
            </div>
            
            {/* Legend for ships that have been sunk */}
            {sunkEnemyShips.size > 0 && (
              <div className="mt-4 bg-blue-100 p-2 rounded-lg border border-blue-300">
                <h3 className="font-bold text-blue-800 mb-1">Sunk Enemy Ships:</h3>
                <div className="flex flex-wrap gap-2">
                  {Array.from(sunkEnemyShips).map(shipId => {
                    const ship = SHIP_DEFINITIONS.find(s => s.id === shipId);
                    return ship ? (
                      <div key={shipId} className="inline-flex items-center bg-green-100 text-green-800 px-2 py-1 rounded">
                        <span className="mr-1">✓</span> {ship.name}
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
          
          {/* Bottom controls */}
          <div className="mt-8 text-center">
            <button
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold"
              onClick={restartGame}
            >
              Restart Game
            </button>
            <Link href="/rules" className="ml-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold">
              Game Rules
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default GamePage;
