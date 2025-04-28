"use client";
import React, { useState, useEffect } from "react";
import { generateBoard } from "../../actions/functions";
import { botTurn as easyBotTurn } from "../../actions/functions";
import { generateProbabilitiesForAllShips, generateNextMove } from "../../actions/probability";
import { createMatrix } from "../../actions/helpers";
import { updateLEDsAfterTurn } from "../../actions/connectionTCP";

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
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
        <div className="relative w-full max-w-md aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-inner border-2 border-gray-700">
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="w-full h-full grid grid-cols-3 grid-rows-3">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="border border-white border-opacity-20"></div>
              ))}
            </div>
            <div className="absolute inset-0 border-2 border-blue-500 border-opacity-50"></div>
          </div>
          {cameraImage ? (
            <img src={cameraImage} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              Position your physical board in view
            </div>
          )}
        </div>

        <div className="w-full max-w-md">
          {cameraImage ? (
            <div className="flex flex-col items-center gap-3">
              {!imageConfirmed ? (
                <>
                  <p className="text-gray-700 text-center">
                    Is your board correctly positioned?
                  </p>
                  <div className="flex gap-3">
                    <button
                      className="btn btn-success"
                      onClick={() => setImageConfirmed(true)}
                    >
                      Confirm
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => {
                        setCameraImage(null);
                        setImageConfirmed(false);
                      }}
                    >
                      Retake
                    </button>
                  </div>
                </>
              ) : (
                <div className="bg-green-100 text-green-800 p-3 rounded-lg text-center">
                  <p className="font-semibold">Image Confirmed!</p>
                  <p className="text-sm">
                    Select a difficulty to start
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const img = await captureImage();
                  if (img) setCameraImage(img);
                }}
              >
                Capture Board
              </button>
              <label className="flex items-center gap-2 mt-2 text-gray-700">
                <input
                  type="checkbox"
                  checked={useTestImage}
                  onChange={() => setUseTestImage((u) => !u)}
                  className="toggle-checkbox"
                />
                Use Test Mode
              </label>
            </div>
          )}
        </div>

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
    );
  }


  // Difficulty selection screen
  if (!difficulty) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-gray-800 text-white p-6 rounded-lg text-center shadow-lg">
          <h1 className="text-2xl font-bold mb-4">Play New Game</h1>
          <div className="grid grid-cols-3 gap-4">
            <button
              className="px-5 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold"
              onClick={() => setDifficulty("easy")}
            >
              Easy
            </button>
            <button
              className="px-5 py-3 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-bold"
              onClick={() => setDifficulty("medium")}
            >
              Normal
            </button>
            <button
              className="px-5 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold"
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
        <h1
          className={`text-3xl mb-4 ${
            winner === "human" ? "text-green-600" : "text-red-600"
          }`}
        >
          {winner === "human" ? "You Win!" : "You Lose!"}
        </h1>
        <button
          className="bg-gray-800 text-white px-4 py-2 rounded"
          onClick={() => setDifficulty(null)}
        >
          Play Again
        </button>
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="mb-4 text-xl">
        {isHumanTurn ? (
          <div className="flex items-center space-x-4">
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

      <div className="flex gap-6">
        {/* Enemy board */}
        <div className="p-2 bg-gradient-to-b from-blue-800 to-blue-600 rounded-lg shadow-xl">
          <h2 className="text-white text-lg mb-2 text-center">
            Enemy Waters
          </h2>
          <div className="grid grid-cols-10 gap-0.5 bg-black p-2 rounded-lg">
          {botGrid.map((row, r) =>
  row.map((cell, c) => {
    const key     = `${c},${r}`;
    const isHit   = cell === "green";
    const isMiss  = cell === "red";
    const attacked = botAttacked.has(key);

    return (
      <div
        key={key}
        className="relative w-10 h-10 rounded-lg bg-blue-500"
        onClick={() => !attacked && handleHumanClick(r, c)}
      >
        {/* MISS: white X */}
        {isMiss && (
          <div
            className="absolute inset-0 flex items-center justify-center text-white text-2xl"
            style={{ animation: "fadeIn 0.25s ease-out forwards" }}
          >
            ✕
          </div>
        )}

        {/* HIT: green drop + smoke */}
        {isHit && (
  <>
    {/* green drop */}
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ animation: "drop 0.3s ease-out forwards" }}
    >
      <div className="w-6 h-6 rounded-full bg-green-500" />
    </div>

    {/* smoke overlay */}
    <div className="smoke pointer-events-none" />
  </>
)}

      </div>
    );
  })
)}

          </div>
        </div>

        {/* Your board */}
        <div className="p-2 bg-gradient-to-b from-red-800 to-red-600 rounded-lg shadow-xl">
          <h2 className="text-white text-lg mb-2 text-center">
            Your Waters
          </h2>
          <div className="grid grid-cols-10 gap-0.5 bg-black p-2 rounded-lg">
            {humanBoard.map((row, r) =>
              row.map((cell, c) => {
                const key = `${c},${r}`;
                const attacked = humanAttacked.has(key);
                const color = attacked
                  ? cell !== 0
                    ? "bg-green-500"
                    : "bg-red-500"
                  : "bg-blue-500";
                return (
                  <div
                    key={key}
                    className={`w-10 h-10 rounded-lg ${
                      attacked ? "opacity-100" : "opacity-80"
                    } ${color}`}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <p>Your Hits: {humanHits}</p>
        <p>Bot Hits: {botHits}</p>
      </div>
    </div>
  );
}

export default GamePage;
