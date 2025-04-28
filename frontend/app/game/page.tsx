"use client";
import React, { useState, useEffect, useCallback } from "react";
import { generateBoard } from "../../actions/functions";
import { botTurn as easyBotTurn } from "../../actions/functions";
import { generateProbabilitiesForAllShips, generateNextMove } from "../../actions/probability";
import { createMatrix } from "../../actions/helpers";
import { updateLEDsAfterTurn } from "../../actions/connectionTCP";
import { updateLEDsListening } from '../../actions/connectionTCP';

// Remove any previous conflicting declarations
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

  // Speech recognition setup - keeping original implementation
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

  // Function to generate board with memoization for performance
  const generateInitialBoard = useCallback((difficultyLevel: "easy" | "medium" | "hard") => {
    const useHard = difficultyLevel === "hard";
    return generateBoard(useHard);
  }, []);

  // When difficulty is selected, initialize boards and reset state
  useEffect(() => {
    if (difficulty) {
      // Flag to prevent state updates after unmount
      let isMounted = true;
      
      const botBoard = generateInitialBoard(difficulty);
      setBotBoard(botBoard);

      // Process the captured image or fall back to random board
      if (cameraImage) {
        processCapturedImage(cameraImage)
          .then((matrix) => {
            if (!isMounted) return;
            if (Array.isArray(matrix)) {
              setHumanBoard(matrix);
              console.log("Processed Human Board:", matrix);
            } else {
              // Fallback if processing fails
              const human = generateInitialBoard(difficulty);
              setHumanBoard(human);
              console.log("Fallback Generated Human Board:", human);
            }
          })
          .catch((err) => {
            if (!isMounted) return;
            console.error("Error processing image:", err);
            const human = generateInitialBoard(difficulty);
            setHumanBoard(human);
            console.log("Fallback Generated Human Board:", human);
          });
      } else {
        // If no image, fall back to generated board
        const human = generateInitialBoard(difficulty);
        setHumanBoard(human);
        console.log("Generated Human Board:", human);
      }

      // Reset displayed grid and game state
      setBotGrid(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill("blue")));
      console.log("Generated Bot Board:", botBoard);

      // Reset game state
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
      
      // Clean up function to prevent state updates after unmount
      return () => {
        isMounted = false;
      };
    }
  }, [difficulty, cameraImage, generateInitialBoard]);

  // Fix the issue with LED zeros timeout by adding a delay
  useEffect(() => {
    // Flag to prevent state updates after unmount
    let isMounted = true;
    
    // Only send zeros to clear LEDs if game hasn't started yet
    if (!gameStarted && !difficulty) {
      console.log('Resetting LEDs on page load/refresh');
      
      // Add a small delay to allow connection to establish
      setTimeout(() => {
        if (!isMounted) return;
        
        // Turn off all LEDs when the page loads using array of zeros
        const emptyArray = Array(200).fill(0);
        fetch('/api/sendLedData', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ledArray: emptyArray }),
        })
          .then(res => {
            if (!isMounted) return;
            console.log('Empty LEDs sent, status', res.status);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          })
          .catch(err => {
            if (!isMounted) return;
            console.error('Error sending empty LEDs:', err);
          });
      }, 1000); // 1 second delay
    }
        
    return () => {
      isMounted = false;
    };
  }, [gameStarted, difficulty]);

  // Fix type safety in processCapturedImage
  const processCapturedImage = async (imgUrl: string): Promise<(number | string)[][] | null> => {
    try {
      const res = await fetch(imgUrl);
      if (!res.ok) {
        throw new Error("Failed to fetch captured image blob");
      }
      const blob = await res.blob();
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result === 'string') {
            resolve(result);
          } else {
            reject(new Error("Failed to convert blob to base64"));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const response = await fetch("/api/processBoard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Data }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      
      const boardData = await response.json();
      return boardData;
    } catch (error) {
      console.error("Error processing captured image:", error);
      return null;
    }
  };
  

  // Improved captureImage function with better error handling and cleanup
  const captureImage = async (): Promise<string | null> => {
    try {
      if (useTestImage) {
        console.log("Using test image instead of camera capture");
        return "/testImage4.jpg";
      }
      
      console.log("Attempting to capture image from camera...");
      const response = await fetch("/api/captureImage");
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to capture image: ${errorText}`);
      }
      
      const blob = await response.blob();
      console.log("Image captured successfully:", blob.size, "bytes,", blob.type);
      
      // Create a new URL for this image
      if (cameraImage) {
        // Clean up previous URL object to prevent memory leaks
        URL.revokeObjectURL(cameraImage);
      }
      
      const imgUrl = URL.createObjectURL(blob);
      console.log("Image URL created:", imgUrl);
      
      return imgUrl;
    } catch (error) {
      console.error("Camera error:", error);
      alert(`Camera Error: ${error instanceof Error ? error.message : 'Failed to capture image'}`);
      return null;
    }
  };

  // Add proper state reset when returning to start screen
  const resetGame = () => {
    // Clean up any existing URL object
    if (cameraImage) {
      URL.revokeObjectURL(cameraImage);
    }
    
    // Reset all game-related state
    setDifficulty(null);
    setCameraImage(null);
    setImageConfirmed(false);
    setGameStarted(false);
    setHumanBoard([]);
    setBotBoard([]);
    setBotGrid(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill("blue")));
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
  };

  // Handle human click on the bot's board
  const handleHumanClick = (row: number, col: number) => {
    // Early return conditions
    if (!isHumanTurn || !difficulty || gameOver) return;
    
    const key = `${col},${row}`;
    if (botAttacked.has(key)) {
      console.log(`Cell ${col},${row} already attacked by human.`);
      return;
    }
    
    // Create a new Set to avoid direct mutation
    const newBotAttacked = new Set(botAttacked);
    newBotAttacked.add(key);
    setBotAttacked(newBotAttacked);
    
    let isHit = false;
    
    // Check if hit or miss and update grid
    if (botBoard[row][col] === 1 || typeof botBoard[row][col] === "string") {
      console.log(`Human attacked ${col},${row} and hit a ship.`);
      isHit = true;
      
      // Update hit counter and check for game over
      setHumanHits((prev) => {
        const newHits = prev + 1;
        if (newHits >= TOTAL_SHIP_SQUARES) {
          setGameOver(true);
          setWinner("human");
        }
        return newHits;
      });
      
      // Update grid for hit
      const newGrid = [...botGrid];
      newGrid[row] = [...newGrid[row]];
      newGrid[row][col] = "green";
      setBotGrid(newGrid);
    } else {
      console.log(`Human attacked ${col},${row} and missed.`);
      
      // Update grid for miss
      const newGrid = [...botGrid];
      newGrid[row] = [...newGrid[row]];
      newGrid[row][col] = "red";
      setBotGrid(newGrid);
    }
    
    // Update LEDs reflecting the human's action IMMEDIATELY
    updateLEDsAfterTurn(humanBoard, botBoard, humanAttacked, newBotAttacked);
    
    // Handle turn logic - only switch turns if missed
    if (!isHit) {
      setIsHumanTurn(false);
      // Pass the *updated* botAttacked set into the timeout closure for botTurn
      setTimeout(() => botTurn(newBotAttacked), 1000);
    } else if (gameOver) {
      // If game is over after this hit, no need to continue
      return;
    }
  };

  // Bot turn logic - accepts the latest botAttacked set as an argument
  const botTurn = (currentBotAttacked: Set<string> = botAttacked) => {
    // Use the passed-in currentBotAttacked, defaulting to state if not provided (e.g., for initial call)
    if (gameOver) return;
    
    let botHitShip = false;
    let nextMove = { row: 0, col: 0 };
    let currentHumanAttacked = humanAttacked; // Start with current state
    
    // Handle bot turn based on difficulty
    if (difficulty === "medium" || difficulty === "hard") {
      // Generate probability grid for intelligent targeting
      const probGrid = generateProbabilitiesForAllShips(boardProbHits, boardProbMisses);
      nextMove = generateNextMove(probGrid);
      
      console.log(`${difficulty} bot selecting ${nextMove.col},${nextMove.row}`);
      
      const key = `${nextMove.col},${nextMove.row}`;
      if (humanAttacked.has(key)) {
        console.log(`Cell ${nextMove.col},${nextMove.row} already attacked by bot.`);
        setTimeout(() => botTurn(currentBotAttacked), 50); // Retry quickly, passing the same botAttacked state
        return;
      }
      
      // Create new Set and add the attacked cell
      const newHumanAttacked = new Set(humanAttacked);
      newHumanAttacked.add(key);
      currentHumanAttacked = newHumanAttacked; // Update the set for this turn's LED update
      
      // Check if hit or miss
      if (humanBoard[nextMove.row][nextMove.col] !== 0) {
        botHitShip = true;
        
        if (difficulty === "hard") {
          // Hard mode: reveal entire boat when hit
          const boatId = humanBoard[nextMove.row][nextMove.col];
          console.log(`Hard bot hit boat ${boatId} at ${nextMove.col},${nextMove.row}. Uncovering entire boat.`);
          
          let addedHits = 0;
          const newHumanBoard = humanBoard.map((r) => [...r]);
          const newProbHits = boardProbHits.map((r) => [...r]);
          
          // Mark all cells of the same boat as hit
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
          
          // Update state
          setHumanAttacked(newHumanAttacked);
          setBoardProbHits(newProbHits);
          setHumanBoard(newHumanBoard);
          
          // Update hit counter and check for game over
          setBotHits((prev) => {
            const newHits = prev + addedHits;
            if (newHits >= TOTAL_SHIP_SQUARES) {
              setGameOver(true);
              setWinner("bot");
            }
            return newHits;
          });
        } else {
          // Medium mode: just mark the single cell as hit
          console.log(`Medium bot hit at ${nextMove.col},${nextMove.row}`);
          
          // Update hit counter and check for game over
          setBotHits((prev) => {
            const newHits = prev + 1;
            if (newHits >= TOTAL_SHIP_SQUARES) {
              setGameOver(true);
              setWinner("bot");
            }
            return newHits;
          });
          
          // Update probability grid
          const newProbHits = boardProbHits.map((r) => [...r]);
          newProbHits[nextMove.row][nextMove.col] = 1;
          setBoardProbHits(newProbHits);
          
          // Important: Update the humanAttacked set
          setHumanAttacked(newHumanAttacked);
        }
      } else {
        // Miss
        console.log(`${difficulty} bot missed at ${nextMove.col},${nextMove.row}`);
        
        // Update probability grid
        const newProbMisses = boardProbMisses.map((r) => [...r]);
        newProbMisses[nextMove.row][nextMove.col] = 1;
        setBoardProbMisses(newProbMisses);
        
        // Important: Update the humanAttacked set
        setHumanAttacked(newHumanAttacked);
      }
      
      // CRITICAL FIX: Pass the newHumanAttacked set (not the state) to update LEDs
      updateLEDsAfterTurn(humanBoard, botBoard, newHumanAttacked, currentBotAttacked);
    } else {
      // Easy difficulty uses the predefined easyBotTurn function
      // We need to get the updated humanAttacked set from easyBotTurn if possible,
      // or rely on the state update (which might cause the same issue for easy)
      // For now, we assume easyBotTurn updates humanAttacked state internally
      // and we read the state `humanAttacked` for the LED update below.
      // If easy mode also shows the bug, easyBotTurn needs modification.
      const updatedQueue = easyBotTurn(
          humanBoard as number[][],
          humanAttacked, // Pass current state
          botQueue,
          () => {
            botHitShip = true;
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
      currentHumanAttacked = humanAttacked; // Read potentially updated state after easyBotTurn
    }
    
    // Update LEDs using the most current attack sets for BOTH players from THIS turn
    updateLEDsAfterTurn(humanBoard, botBoard, currentHumanAttacked, currentBotAttacked);
    console.log("Bot turn completed.");
    
    // Handle turn logic
    if (botHitShip && !gameOver) {
      // Pass the *same* currentBotAttacked set for the next consecutive bot turn
      setTimeout(() => botTurn(currentBotAttacked), 1000);
    } else {
      setIsHumanTurn(true);
    }
  };

  // Keep original voice attack handler
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
        return alert("Sorry, I didn't catch a valid cell (e.g. B7). Try again.");
      }
      const row = "ABCDEFGHIJ".indexOf(m[1]);
      const col = parseInt(m[2], 10) - 1;
      handleHumanClick(row, col);
    };
    recognizer.onerror = (e: any) => {
      console.error("Speech error", e);
      alert("Sorry, couldn't understand you. Please try again.");
    };
  
    recognizer.start();
    updateLEDsListening();
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
            {/* this difficulty will not be played any more. 
             <button
              className="px-5 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold"
              onClick={() => setDifficulty("hard")}
            >
              Hard
            </button> */}
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
          onClick={resetGame}
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
      {/* Enemy board with headers */}
<div className="p-2 bg-gradient-to-b from-blue-800 to-blue-600 rounded-lg shadow-xl">
  <h2 className="text-white text-lg mb-2 text-center">Enemy Waters</h2>
  <div className="grid grid-cols-11 gap-0.5 bg-blue-1000 p-2 rounded-lg">
    {/* top-left blank corner */}
    <div className="w-10 h-10"></div>
    {/* column digits */}
    {["1","2","3","4","5","6","7","8","9","10"].map((letter) => (
      <div
        key={letter}
        className="w-10 h-10 flex items-center justify-center text-white font-bold"
      >
        {letter}
      </div>
    ))}

    {/* now each row: first the row number, then 10 cells */}
    {botGrid.map((row, r) => (
      <React.Fragment key={r}>
        {/* row label */}
        <div className="w-10 h-10 flex items-center justify-center text-white font-bold">
        {String.fromCharCode(65 + r)}
        </div>
        {/* each cell */}
        {row.map((cell, c) => {
          const key = `${c},${r}`;
          const isHit = cell === "green";
          const isMiss = cell === "red";
          const attacked = botAttacked.has(key);
          return (
            <div
              key={key}
              className="relative w-10 h-10 rounded-lg bg-sky-400"
              onClick={() => !attacked && handleHumanClick(r, c)}
            >
              {/* miss X */}
              {isMiss && (
                <div
                  className="absolute inset-0 flex items-center justify-center text-white text-2xl animate-fadeIn"
                >
                  ✕
                </div>
              )}
              {/* hit drop + smoke */}
              {isHit && (
                <>
                  <div className="absolute inset-0 flex items-center justify-center animate-drop">
                    <div className="w-6 h-6 rounded-full bg-green-500" />
                  </div>
                  <div className="smoke-effect">
                    <div className="smoke smoke-1"></div>
                    <div className="smoke smoke-2"></div>
                    <div className="smoke smoke-3"></div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </React.Fragment>
    ))}
  </div>
</div>
{/* Your Waters */}
<div className="p-2 bg-gradient-to-b from-red-800 to-red-600 rounded-lg shadow-xl">
  <h2 className="text-white text-lg mb-2 text-center">Your Waters</h2>

  {/* 11-col grid: corner + A–J, then 1–10 down the side */}
  <div className="grid grid-cols-11 gap-1 bg-gradient-to-b from-red-800 to-red-600 p-2 rounded-lg">
    {/* top-left blank */}
    <div className="w-10 h-10" />

    {/* top headers: A–J */}
    {["1","2","3","4","5","6","7","8","9","10"].map((letter) => (
      <div
        key={letter}
        className="w-10 h-10 flex items-center justify-center text-white font-bold"
      >
        {letter}
      </div>
    ))}

    {/* rows */}
    {humanBoard.map((rowArr, r) => (
      <React.Fragment key={`row-${r}`}>
        {/* side header: 1–10 */}
        <div className="w-10 h-10 flex items-center justify-center text-white font-bold">
        {String.fromCharCode(65 + r)}
        </div>

        {/* the 10 cells */}
        {rowArr.map((cellID, c) => {
          const key     = `${c},${r}`;
          const attacked= humanAttacked.has(key);
          const isMiss  = attacked && cellID === 0;
          const isHit   = attacked && cellID !== 0;

          // ship-segment shape logic (same as before)…
          let shapeClass = "";
          if (cellID !== 0) {
            const up    = r > 0    && humanBoard[r-1][c] === cellID;
            const down  = r < 9    && humanBoard[r+1][c] === cellID;
            const left  = c > 0    && humanBoard[r][c-1] === cellID;
            const right = c < 9    && humanBoard[r][c+1] === cellID;
            const horiz = left || right;

            let pos: "single"|"start"|"middle"|"end";
            if (!up && !down && !left && !right)            pos="single";
            else if (horiz) {
              if (!left)      pos="start";
              else if (!right)pos="end";
              else            pos="middle";
            } else {
              if (!up)        pos="start";
              else if (!down) pos="end";
              else            pos="middle";
            }

            if (pos==="single")         shapeClass="ship-single";
            else if (horiz) {
              if (pos==="start")         shapeClass="ship-bow-horizontal";
              else if (pos==="end")      shapeClass="ship-stern-horizontal";
              else                        shapeClass="ship-middle-horizontal";
            } else {
              if (pos==="start")         shapeClass="ship-bow-vertical";
              else if (pos==="end")      shapeClass="ship-stern-vertical";
              else                        shapeClass="ship-middle-vertical";
            }
          }

          // flex alignment so bow/stern hug edges
          const wrapperFlex = (() => {
            if (shapeClass.includes("horizontal")) {
              if (shapeClass.includes("bow"))   return "justify-start items-center";
              if (shapeClass.includes("stern")) return "justify-end items-center";
              return "justify-center items-center";
            } else if (shapeClass.includes("vertical")) {
              if (shapeClass.includes("bow"))   return "items-start justify-center";
              if (shapeClass.includes("stern")) return "items-end justify-center";
              return "items-center justify-center";
            }
            return "justify-center items-center";
          })();

          return (
            <div key={key} className="relative w-10 h-10">
              {/* base water */}
              <div className="absolute inset-0 bg-blue-500 rounded-lg" />

              {/* ship (always visible) */}
              {cellID !== 0 && (
                <div className={`absolute inset-0 flex ${wrapperFlex}`}>
                  <div className={`ship-part ${shapeClass} bg-black`} />
                </div>
              )}

              {/* miss X */}
              {isMiss && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 22 22" className="miss-x">
                    <line x1="4" y1="4" x2="18" y2="18" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="18" y1="4" x2="4" y2="18" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                </div>
              )}

              {/* hit drop + smoke */}
              {isHit && (
                <>
                  <div className="absolute inset-0 flex items-center justify-center animate-drop">
                    <div className="w-6 h-6 rounded-full bg-red-500" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="smoke-effect">
                      <div className="smoke smoke-1"/>
                      <div className="smoke smoke-2"/>
                      <div className="smoke smoke-3"/>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </React.Fragment>
    ))}
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
