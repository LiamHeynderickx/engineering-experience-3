"use client";
import React, { useState, useEffect } from "react";
import { generateBoard } from "../../actions/functions";
import { botTurn as easyBotTurn } from "../../actions/functions";
import { generateProbabilitiesForAllShips, generateNextMove } from "../../actions/probability";
import { createMatrix } from "../../actions/helpers";
import { updateLEDsAfterTurn } from "../../actions/connectionTCP";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const GRID_SIZE = 10;
const TOTAL_SHIP_SQUARES = 17;


const GamePage = () => {
  // Game control states
  const [gameStarted, setGameStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | null>(null);

  // Image capture states
  const [cameraImage, setCameraImage] = useState<string | null>(null);
  const [imageConfirmed, setImageConfirmed] = useState(false);
  const [useTestImage, setUseTestImage] = useState(false);

  // Game boards & display
  const [botGrid, setBotGrid] = useState<string[][]>(
    Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill("blue"))
  );
  const [botBoard, setBotBoard] = useState<(number | string)[][]>([]);
  const [humanBoard, setHumanBoard] = useState<(number | string)[][]>([]);

  // Counters & turn management
  const [humanHits, setHumanHits] = useState(0);
  const [botHits, setBotHits] = useState(0);
  const [isHumanTurn, setIsHumanTurn] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<"human" | "bot" | null>(null);

  // Attacked cells
  const [botAttacked, setBotAttacked] = useState<Set<string>>(new Set());
  const [humanAttacked, setHumanAttacked] = useState<Set<string>>(new Set());

  // For easy bot queue
  const [botQueue, setBotQueue] = useState<{ x: number; y: number }[]>([]);

  // For probability strategies (medium and hard)
  const [boardProbHits, setBoardProbHits] = useState<number[][]>(createMatrix(GRID_SIZE, GRID_SIZE, 0));
  const [boardProbMisses, setBoardProbMisses] = useState<number[][]>(createMatrix(GRID_SIZE, GRID_SIZE, 0));

  // at top of your GamePage component
  let recognizer: any = null;
  if (typeof window !== "undefined") {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (Speech) {
      recognizer = new Speech();
      recognizer.lang = "en-US";
      recognizer.interimResults = false;
      recognizer.maxAlternatives = 1;
    }
  }
  
  const handleVoiceAttack = () => {
    if (!isHumanTurn || !recognizer || !difficulty || gameOver) return;
  
    recognizer.onstart = () => console.log("🎤 Listening for coordinate…");
    // 2) use `any` for the event
    recognizer.onresult = (evt: any) => {
      const text = evt.results[0][0].transcript
                    .trim()
                    .toUpperCase()
                    .replace(/\s+/g, "");
      console.log("Heard:", text);
      const m = text.match(/^([A-J])([1-9]|10)$/);
      if (!m) {
        return alert("Sorry, I didn’t catch a valid cell (e.g. B7). Try again.");
      }
      const col = "ABCDEFGHIJ".indexOf(m[1]);
      const row = parseInt(m[2], 10) - 1;
      handleHumanClick(row, col);
    };
    recognizer.onerror = (e: any) => {
      console.error("Speech error", e);
      alert("Sorry, couldn’t understand you. Please try again.");
    };
  
    recognizer.start();
  };


  // When difficulty is selected, initialize boards and reset state.
  // After image capture, we call our new processBoard endpoint.
  useEffect(() => {
    if (difficulty) {
      const useHard = difficulty === "hard";
      const bot = generateBoard(useHard);
      setBotBoard(bot);

      // Instead of generating the human board randomly, process the captured image.
      if (cameraImage) {
        processCapturedImage(cameraImage)
          .then((matrix) => {
                if (Array.isArray(matrix)) {
                  setHumanBoard(matrix);
                  console.log("Processed Human Board:", matrix);
            } else {
              // Fallback if processing fails.
              const human = generateBoard(useHard);
              setHumanBoard(human);
              console.log("Fallback Generated Human Board:", human);
            }
          })
          .catch((err) => {
            console.error("Error processing image:", err);
            const human = generateBoard(useHard);
            setHumanBoard(human);
            console.log("Fallback Generated Human Board:", human);
          });
      } else {
        // If no image, fall back.
        const human = generateBoard(useHard);
        setHumanBoard(human);
        console.log("Fallback Generated Human Board:", human);
      }

      // Reset displayed grid
      setBotGrid(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill("blue")));
      console.log("Generated Bot Board:", bot);

      // Reset counters and state.
      setHumanHits(0);
      setBotHits(0);
      setBotAttacked(new Set());
      setHumanAttacked(new Set());
      setBotQueue([]);
      setIsHumanTurn(true);
      setGameOver(false);
      setWinner(null);
      setBoardProbHits(createMatrix(GRID_SIZE, GRID_SIZE, 0));
      setBoardProbMisses(createMatrix(GRID_SIZE, GRID_SIZE, 0));
    }
  }, [difficulty, cameraImage]);

  // Function to process the captured image by sending it to the processBoard endpoint.
  const processCapturedImage = async (imgUrl: string): Promise<any> => {
    try {
      const res = await fetch(imgUrl);
      if (!res.ok) {
        throw new Error("Failed to fetch captured image blob");
      }
      const blob = await res.blob();
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const response = await fetch("/api/processBoard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Data }),
      });
      if (!response.ok) throw new Error(await response.text());
      const boardData = await response.json();
      return boardData;
    } catch (error) {
      console.error("Error processing captured image:", error);
      return null;
    }
  };
  

  // Capture image function.
  // If test mode is enabled, return a local test image.
  const captureImage = async (): Promise<string | null> => {
    if (useTestImage) {
      return "/testImage4.jpg";
    }
    try {
      const response = await fetch("/api/captureImage");
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      console.log("Image Blob:", blob);
      const imgUrl = URL.createObjectURL(blob);
      console.log("Image URL:", imgUrl);
      return imgUrl;
    } catch (error) {
      console.error("Camera error:", error);
      alert("Camera Error: Failed to capture image");
      return null;
    }
  };

  // Handle human click on the bot's board.
  const handleHumanClick = (row: number, col: number) => {
    if (!isHumanTurn || !difficulty || gameOver) return;
    const key = `${col},${row}`;
    if (botAttacked.has(key)) {
      console.log(`Cell ${col},${row} already attacked by human.`);
      return;
    }
    botAttacked.add(key);
    if (botBoard[row][col] === 1 || typeof botBoard[row][col] === "string") {
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
        r.map((cell, cIndex) => (rIndex === row && cIndex === col ? "green" : cell))
      );
      setBotGrid(newGrid);
    } else {
      console.log(`Human attacked ${col},${row} and missed.`);
      const newGrid = botGrid.map((r, rIndex) =>
        r.map((cell, cIndex) => (rIndex === row && cIndex === col ? "red" : cell))
      );
      setBotGrid(newGrid);
    }
    updateLEDsAfterTurn(humanBoard, botBoard, humanAttacked, botAttacked);
    setIsHumanTurn(false);
    setTimeout(() => {
      if (!gameOver) {
        if (difficulty === "medium") {
          const probGrid = generateProbabilitiesForAllShips(boardProbHits, boardProbMisses);
          console.log("Probability board (medium):", probGrid);
          const { row: nextRow, col: nextCol } = generateNextMove(probGrid);
          console.log(`Medium bot selecting ${nextCol},${nextRow}`);
          if (humanBoard[nextRow][nextCol] !== 0) {
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
            // Update humanAttacked because bot is attacking human board.
            const newHumanAttacked = new Set(humanAttacked);
            newHumanAttacked.add(`${nextCol},${nextRow}`);
            updateLEDsAfterTurn(humanBoard, botBoard, newHumanAttacked, botAttacked);
            setHumanAttacked(newHumanAttacked);
          } else {
            console.log(`Medium bot missed at ${nextCol},${nextRow}`);
            const newProbMisses = boardProbMisses.map((r) => [...r]);
            newProbMisses[nextRow][nextCol] = 1;
            setBoardProbMisses(newProbMisses);
            const newHumanAttacked = new Set(humanAttacked);
            newHumanAttacked.add(`${nextCol},${nextRow}`);
            updateLEDsAfterTurn(humanBoard, botBoard, newHumanAttacked, botAttacked);
            setHumanAttacked(newHumanAttacked);
          }
      
        } else if (difficulty === "hard") {
          const probGrid = generateProbabilitiesForAllShips(boardProbHits, boardProbMisses);
          console.log("Probability board (hard):", probGrid);
          const { row: nextRow, col: nextCol } = generateNextMove(probGrid);
          console.log(`Hard bot selecting ${nextCol},${nextRow}`);
          if (humanBoard[nextRow][nextCol] !== 0) {
            const boatId = humanBoard[nextRow][nextCol];
            console.log(`Hard bot hit boat ${boatId} at ${nextCol},${nextRow}. Uncovering entire boat.`);
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
            const newHumanAttacked = new Set(humanAttacked);
            newHumanAttacked.add(`${nextCol},${nextRow}`);
            setHumanAttacked(newHumanAttacked);
          }
          updateLEDsAfterTurn(humanBoard, botBoard, humanAttacked, botAttacked);
        } else {
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
          updateLEDsAfterTurn(humanBoard, botBoard, humanAttacked, botAttacked);
        }
        console.log("Bot turn completed.");
        //updateLEDsAfterTurn(humanBoard, botBoard, humanAttacked, botAttacked);
        setIsHumanTurn(true);
      }
    }, 1000);
  };

  // Start Game Section: Capture Image / Test Mode
  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="relative w-full max-w-md aspect-video bg-gray-800 rounded-lg overflow-hidden">
          {cameraImage ? (
            <img
              src={cameraImage}
              alt="Camera Preview"
              className="w-full h-full object-cover border border-red-500"
              onLoad={() => console.log("Image loaded successfully")}
              onError={() => console.error("Failed to load image")}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              Camera feed will appear here
            </div>
          )}
        </div>
        <div className="flex gap-4">
          {!cameraImage && (
            <>
              <button
                className="bg-blue-500 hover:bg-blue-700 text-white px-6 py-3 rounded text-xl"
                onClick={async () => {
                  try {
                    const imgUrl = await captureImage();
                    if (imgUrl) {
                      setCameraImage(imgUrl);
                    }
                  } catch (error) {
                    alert("Camera Error: Unexpected error occurred.");
                  }
                }}
              >
                Start Game (Take Picture)
              </button>
              <button
                className="bg-purple-500 hover:bg-purple-700 text-white px-6 py-3 rounded text-xl"
                onClick={async () => {
                  // Enable test mode: use a local test image.
                  setUseTestImage(true);
                  const testImg = "/testImage4.jpg"; // Place a test image in your public folder.
                  setCameraImage(testImg);
                }}
              >
                Test Mode (Random Image)
              </button>
            </>
          )}
          {cameraImage && (
            <button
              className="bg-green-500 hover:bg-green-700 text-white px-6 py-3 rounded text-xl"
              onClick={() => {
                setImageConfirmed(true);
                setGameStarted(true);
              }}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!imageConfirmed) {
    return null;
  }

  // Difficulty selection screen
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
  {isHumanTurn ? (
    <div className="space-x-4">
      <span>Your Turn</span>
      <button
        className="bg-indigo-500 hover:bg-indigo-700 text-white px-3 py-1 rounded"
        onClick={handleVoiceAttack}
      >
        Attack by Voice
      </button>
    </div>
  ) : (
    "Bot's Turn"
  )}
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
