"use client";
import React, { useState, useEffect } from "react";
import { generateBoard } from "../../actions/functions";
import { botTurn as easyBotTurn } from "../../actions/functions"; // the existing easy bot strategy
import {
  generateProbabilitiesForAllShips,
  generateNextMove,
} from "../../actions/probability";
import { createMatrix } from "../../actions/helpers";

const GRID_SIZE = 10;
// For standard battleship, the total occupied squares are 5+4+3+3+2 = 17.
const TOTAL_SHIP_SQUARES = 17;

const GamePage = () => {
  const [difficulty, setDifficulty] = useState<
    "easy" | "medium" | "hard" | null
  >(null);

  // Display grid for the bot's board (what the human attacks)
  const [botGrid, setBotGrid] = useState<string[][]>(
    Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill("blue"))
  );

  // Underlying boards
  // For the human board (the one the bot attacks), if hard is selected, we generate with unique boat IDs.
  const [botBoard, setBotBoard] = useState<(number | string)[][]>([]);
  const [humanBoard, setHumanBoard] = useState<(number | string)[][]>([]);

  // Hit counters
  const [humanHits, setHumanHits] = useState(0);
  const [botHits, setBotHits] = useState(0);

  // Turn control
  const [isHumanTurn, setIsHumanTurn] = useState(true);

  // Attacked squares sets
  const [botAttacked, setBotAttacked] = useState<Set<string>>(new Set()); // squares attacked by human on bot board
  const [humanAttacked, setHumanAttacked] = useState<Set<string>>(new Set()); // squares attacked by bot on human board

  // For the easy bot (or chain-based logic) we have a queue.
  const [botQueue, setBotQueue] = useState<{ x: number; y: number }[]>([]);

  // For the probability-based strategy (used for medium and hard), we maintain two 10×10 matrices:
  // boardProbHits: a hit is represented as 1; boardProbMisses: a miss is marked (say, as 1).
  const [boardProbHits, setBoardProbHits] = useState<number[][]>(
    createMatrix(GRID_SIZE, GRID_SIZE, 0)
  );
  const [boardProbMisses, setBoardProbMisses] = useState<number[][]>(
    createMatrix(GRID_SIZE, GRID_SIZE, 0)
  );

  // Game over state
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<"human" | "bot" | null>(null);

  // On difficulty selection (or Play Again), generate boards and reset state.
  useEffect(() => {
    if (difficulty) {
      // For hard difficulty, generate boards with unique boat IDs.
      const useHard = difficulty === "hard";
      const bot = generateBoard(useHard);
      const human = generateBoard(useHard);
      setBotBoard(bot);
      setHumanBoard(human);

      // Reset displayed grid
      setBotGrid(
        Array(GRID_SIZE)
          .fill(null)
          .map(() => Array(GRID_SIZE).fill("blue"))
      );

      console.log("Generated Bot Board:", bot);
      console.log("Generated Human Board:", human);

      // Reset counters and state.
      setHumanHits(0);
      setBotHits(0);
      setBotAttacked(new Set());
      setHumanAttacked(new Set());
      setBotQueue([]);
      setIsHumanTurn(true);
      setGameOver(false);
      setWinner(null);

      // For probability bot matrices.
      setBoardProbHits(createMatrix(GRID_SIZE, GRID_SIZE, 0));
      setBoardProbMisses(createMatrix(GRID_SIZE, GRID_SIZE, 0));
    }
  }, [difficulty]);

  // Handle human clicks on the bot's board.
  const handleHumanClick = (row: number, col: number) => {
    if (!isHumanTurn || !difficulty || gameOver) return;
    const key = `${col},${row}`;
    if (botAttacked.has(key)) {
      console.log(`Cell ${col},${row} already attacked by human.`);
      return;
    }
    botAttacked.add(key);

    // Process human attack on bot's board.
    if (botBoard[row][col] === 1 || typeof botBoard[row][col] === "string") {
      // A hit on bot's board: (for human side, we use the standard logic)
      console.log(`Human attacked ${col},${row} and hit a ship.`);
      setHumanHits((prev) => {
        const newHits = prev + 1;
        if (newHits >= TOTAL_SHIP_SQUARES) {
          setGameOver(true);
          setWinner("human");
        }
        return newHits;
      });
      const newGrid = botGrid.map((r, rIndex) =>
        r.map((cell, cIndex) =>
          rIndex === row && cIndex === col ? "green" : cell
        )
      );
      setBotGrid(newGrid);
    } else {
      console.log(`Human attacked ${col},${row} and missed.`);
      const newGrid = botGrid.map((r, rIndex) =>
        r.map((cell, cIndex) =>
          rIndex === row && cIndex === col ? "red" : cell
        )
      );
      setBotGrid(newGrid);
    }

    // End human turn, then trigger bot turn after delay.
    setIsHumanTurn(false);
    setTimeout(() => {
      if (!gameOver) {
        if (difficulty === "medium") {
          // Medium uses the probability strategy (one shot per turn).
          const probGrid = generateProbabilitiesForAllShips(
            boardProbHits,
            boardProbMisses
          );
          console.log("Probability board (medium):", probGrid);
          const { row: nextRow, col: nextCol } = generateNextMove(probGrid);
          console.log(`Medium bot selecting ${nextCol},${nextRow}`);
          if (humanBoard[nextRow][nextCol] !== 0) {
            // A hit: update matrices.
            console.log(`Medium bot hit at ${nextCol},${nextRow}`);
            setBotHits((prev) => {
              const newHits = prev + 1;
              if (newHits >= TOTAL_SHIP_SQUARES) {
                setGameOver(true);
                setWinner("bot");
              }
              return newHits;
            });
            const newProbHits = boardProbHits.map((r) => [...r]);
            newProbHits[nextRow][nextCol] = 1;
            setBoardProbHits(newProbHits);
          } else {
            console.log(`Medium bot missed at ${nextCol},${nextRow}`);
            const newProbMisses = boardProbMisses.map((r) => [...r]);
            newProbMisses[nextRow][nextCol] = 1;
            setBoardProbMisses(newProbMisses);
          }
        } else if (difficulty === "hard") {
          // Hard difficulty: use the probability strategy but if a hit occurs,
          // then destroy the entire boat (all cells with the same boat id) in one turn.
          const probGrid = generateProbabilitiesForAllShips(
            boardProbHits,
            boardProbMisses
          );
          console.log("Probability board (hard):", probGrid);
          const { row: nextRow, col: nextCol } = generateNextMove(probGrid);
          console.log(`Hard bot selecting ${nextCol},${nextRow}`);
          if (humanBoard[nextRow][nextCol] !== 0) {
            // A hit: retrieve the boat id.
            const boatId = humanBoard[nextRow][nextCol];
            console.log(
              `Hard bot hit boat ${boatId} at ${nextCol},${nextRow}. Uncovering entire boat.`
            );
            let addedHits = 0;
            const newHumanBoard = humanBoard.map((r) => [...r]);
            const newProbHits = boardProbHits.map((r) => [...r]);
            const newHumanAttacked = new Set(humanAttacked);
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
            setHumanAttacked(newHumanAttacked);
            setBoardProbHits(newProbHits);
            setHumanBoard(newHumanBoard);
            setBotHits((prev) => {
              const newHits = prev + addedHits;
              if (newHits >= TOTAL_SHIP_SQUARES) {
                setGameOver(true);
                setWinner("bot");
              }
              return newHits;
            });
          } else {
            console.log(`Hard bot missed at ${nextCol},${nextRow}`);
            const newProbMisses = boardProbMisses.map((r) => [...r]);
            newProbMisses[nextRow][nextCol] = 1;
            setBoardProbMisses(newProbMisses);
          }
        } else {
          // Easy and hard (if not using probability) fallback to previous bot strategy.
          const updatedQueue = easyBotTurn(
            humanBoard as number[][],
            humanAttacked,
            botQueue,
            () => {
              setBotHits((prev) => {
                const newHits = prev + 1;
                if (newHits >= TOTAL_SHIP_SQUARES) {
                  setGameOver(true);
                  setWinner("bot");
                }
                return newHits;
              });
            }
          );
          setBotQueue([...updatedQueue]);
        }
        console.log("Bot turn completed.");
        setIsHumanTurn(true);
      }
    }, 1000);
  };

  if (!difficulty) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-gray-800 text-white p-6 rounded-lg text-center shadow-lg">
          <h1 className="text-2xl font-bold mb-4">Play New Game</h1>
          <div className="flex justify-center space-x-4">
            <button
              className="bg-green-500 hover:bg-green-700 px-4 py-2 rounded"
              onClick={() => setDifficulty("easy")}
            >
              Easy
            </button>
            <button
              className="bg-yellow-500 hover:bg-yellow-700 px-4 py-2 rounded"
              onClick={() => setDifficulty("medium")}
            >
              Normal
            </button>
            <button
              className="bg-red-500 hover:bg-red-700 px-4 py-2 rounded"
              onClick={() => setDifficulty("hard")}
            >
              Hard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        {winner === "human" ? (
          <h1 className="text-green-600 text-3xl mb-4">You Win!</h1>
        ) : (
          <h1 className="text-red-600 text-3xl mb-4">You Lose!</h1>
        )}
        <button
          onClick={() => setDifficulty(null)}
          className="bg-gray-800 text-white px-4 py-2 rounded"
        >
          Play Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="mb-4 text-center text-xl">
        {isHumanTurn ? "Your Turn" : "Bot's Turn"}
      </div>
      <div className="grid grid-cols-10 gap-0.5 bg-black p-2 rounded-lg">
        {botGrid.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`w-10 h-10 rounded-lg cursor-pointer transition-colors ${
                cell === "blue"
                  ? "bg-blue-500"
                  : cell === "green"
                  ? "bg-green-500"
                  : "bg-red-500"
              }`}
              onClick={() => handleHumanClick(rowIndex, colIndex)}
            />
          ))
        )}
      </div>
      <div className="mt-4 text-center">
        <p>Human Hits: {humanHits}</p>
        <p>Bot Hits: {botHits}</p>
      </div>
    </div>
  );
};

export default GamePage;
