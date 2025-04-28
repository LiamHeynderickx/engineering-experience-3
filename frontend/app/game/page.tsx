"use client";
import React, { useState, useEffect, useCallback } from "react";
import { generateBoard } from "../../actions/functions";
import { botTurn as easyBotTurn } from "../../actions/functions";
import { generateProbabilitiesForAllShips, generateNextMove } from "../../actions/probability";
import { createMatrix } from "../../actions/helpers";
import { updateLEDsAfterTurn, updateLEDsListening, updateLEDsVictory, updateLEDsDefeat } from '../../actions/connectionTCP';
import { createModel, KaldiRecognizer } from "vosk-browser";
import { recordAudio, blobToDataURL } from '../../utils/audio'

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
// Hold the Vosk recognizer
const [voskRec, setVoskRec] = useState<KaldiRecognizer | null>(null);
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
 
  
  // Function to reset LEDs explicitly
  const resetLEDs = () => {
    console.log('Explicitly resetting LEDs');
    const emptyArray = Array(200).fill(0);
    fetch('/api/sendLedData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ledArray: emptyArray }),
    })
      .then(res => {
        console.log('LEDs reset, status', res.status);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      })
      .catch(err => {
        console.error('Error resetting LEDs:', err);
      });
  };

  // Fix the issue with LED zeros timeout by adding a delay
  useEffect(() => {
    // Flag to prevent state updates after unmount
    let isMounted = true;
    
    // Reset the LEDs whenever component mounts
    console.log('Resetting LEDs on page load/refresh');
    
    // Reset immediately and then again after a delay to ensure connection
    resetLEDs();
    
    // Add a small delay to allow connection to establish
    setTimeout(() => {
      if (!isMounted) return;
      resetLEDs();
    }, 1000); // 1 second delay
        
    return () => {
      isMounted = false;
      // Also try to reset when unmounting
      resetLEDs();
    };
  }, []); // Run only once on component mount

  // Effect to trigger game over LED sequence
  useEffect(() => {
    if (gameOver) {
      if (winner === 'human') {
        updateLEDsVictory();
      } else if (winner === 'bot') {
        updateLEDsDefeat();
      }
    }
    // Dependency array ensures this runs only when gameOver or winner changes
  }, [gameOver, winner]);

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
    
    // Reset LEDs explicitly with zeros
    resetLEDs();
    
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
          console.log("Game Over - Human Wins!");
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

  // Bot turn logic - Aligning medium/hard post-hit logic with easy mode
  const botTurn = (
      currentBotAttacked: Set<string> = botAttacked, // Bot's attacks THIS turn
      latestHumanAttacked: Set<string> = humanAttacked // Human's state BEFORE this turn
  ) => {
    if (gameOver) return;

    console.log("Bot's turn starting with latestHumanAttacked:", latestHumanAttacked);

    // Use the passed-in humanAttacked state, default to component state if first turn
    let currentHumanAttacked = new Set(latestHumanAttacked);
    let hitShip = false;

    if (difficulty === "medium" || difficulty === "hard") {
      try {
        // Generate probability grid for intelligent targeting
        // First, we need to make sure our probability grid accounts for cells we've already attacked
        // Copy the current board states
        const currentProbHits = [...boardProbHits.map(row => [...row])];
        const currentProbMisses = [...boardProbMisses.map(row => [...row])];

        // Mark all cells that have been attacked in our probability matrices
        // This ensures the generateNextMove function won't select already attacked cells
        for (let i = 0; i < GRID_SIZE; i++) {
          for (let j = 0; j < GRID_SIZE; j++) {
            const cellKey = `${j},${i}`;
            if (currentHumanAttacked.has(cellKey)) {
              // If it was a hit, mark in hit matrix
              if (humanBoard[i][j] !== 0) {
                currentProbHits[i][j] = 1;
              } else {
                // Otherwise mark as miss
                currentProbMisses[i][j] = 1;
              }
            }
          }
        }

        // Now generate the probability grid using our updated matrices
        const probGrid = generateProbabilitiesForAllShips(currentProbHits, currentProbMisses);

        // Debug log to make sure probGrid reflects our attacked cells
        console.log(`Generated probability grid, checking for already attacked cells...`);

        // Get next move from probability grid
        const nextMove = generateNextMove(probGrid);

        console.log(`${difficulty} bot selecting ${nextMove.col},${nextMove.row}`);

        // Check if cell has already been attacked using the LATEST set
        const key = `${nextMove.col},${nextMove.row}`;
        if (currentHumanAttacked.has(key)) {
          console.log(`Cell ${key} already attacked by bot, retrying...`);
          // Retry with the SAME latestHumanAttacked state
          setTimeout(() => botTurn(currentBotAttacked, latestHumanAttacked), 50);
          return;
        }

        // Add the cell to the attacked set for THIS turn
        currentHumanAttacked.add(key);

        // Check if hit or miss
        const targetValue = humanBoard[nextMove.row][nextMove.col];
        if (targetValue !== 0) {
          // It's a hit!
          hitShip = true;
          console.log(`${difficulty} bot hit at ${key}`, targetValue);

          if (difficulty === "hard") {
            // Hard mode: reveal entire boat
            const boatId = targetValue;
            let addedHits = 0;
            const newProbHits = [...boardProbHits.map(row => [...row])];

            // Mark all cells of the same boat as hit in hard mode
            for (let i = 0; i < GRID_SIZE; i++) {
              for (let j = 0; j < GRID_SIZE; j++) {
                if (humanBoard[i][j] === boatId) {
                  newProbHits[i][j] = 1;
                  const cellKey = `${j},${i}`;
                  // Use currentHumanAttacked for the check and update
                  if (!currentHumanAttacked.has(cellKey)) {
                    currentHumanAttacked.add(cellKey);
                    addedHits++;
                  }
                }
              }
            }

            // Update state using the set updated within this turn
            setHumanAttacked(new Set(currentHumanAttacked));
            setBoardProbHits(newProbHits);

            // Update hit counter and check for game over
            setBotHits(prev => {
              const newHits = prev + addedHits;
              if (newHits >= TOTAL_SHIP_SQUARES) {
                console.log("Game Over - Bot Wins!");
                setGameOver(true);
                setWinner("bot");
                return newHits;
              }

              // Continue with the bot's next turn after state updates
              if (hitShip) {
                console.log(`Hard bot hit a ship, going again after delay`);
                setTimeout(() => botTurn(currentBotAttacked, currentHumanAttacked), 1000);
              }

              return newHits;
            });
          } else {
            // Medium mode: single hit
            const newProbHits = [...boardProbHits.map(row => [...row])];
            newProbHits[nextMove.row][nextMove.col] = 1;

            // Update state using the set updated within this turn - IMPORTANT!
            setHumanAttacked(new Set(currentHumanAttacked));
            setBoardProbHits(newProbHits);

            // Update hit counter and check for game over
            setBotHits(prev => {
              const newHits = prev + 1;
              if (newHits >= TOTAL_SHIP_SQUARES) {
                console.log("Game Over - Bot Wins!");
                setGameOver(true);
                setWinner("bot");
                return newHits;
              }

              // Continue with the bot's next turn after state updates are complete
              // This is the critical fix - schedule the next turn from inside setState callback
              console.log("Medium bot hit a ship, going again after delay");
              setTimeout(() => {
                console.log("Medium bot scheduling next turn with updated probabilities");
                botTurn(currentBotAttacked, currentHumanAttacked);
              }, 1000);

              return newHits;
            });

            // REMOVE THIS SECTION - we already scheduled the next turn in the setBotHits callback
            // Don't schedule another turn here outside the state update callback
          }
        } else {
          // Miss
          console.log(`${difficulty} bot missed at ${key}`);
          const newProbMisses = [...boardProbMisses.map(row => [...row])];
          newProbMisses[nextMove.row][nextMove.col] = 1;

          // Update state using the set updated within this turn
          setHumanAttacked(new Set(currentHumanAttacked));
          setBoardProbMisses(newProbMisses);

          // Update LEDs with the results of THIS turn
          updateLEDsAfterTurn(humanBoard, botBoard, currentHumanAttacked, currentBotAttacked);

          // Return control to player
          console.log("Bot missed, returning control to player");
          setIsHumanTurn(true);
        }

        // Only update LEDs here if it was a hit (misses already updated LEDs)
        if (hitShip) {
          updateLEDsAfterTurn(humanBoard, botBoard, currentHumanAttacked, currentBotAttacked);
        }

        // IMPORTANT: We've moved the recursive calls into state update callbacks
        // Additionally, added a safety timeout to prevent infinite loops
        if (hitShip && !gameOver) {
          // Since we've already scheduled the next turn inside the state update callbacks,
          // we don't need any additional scheduling here
          console.log("Bot hit handling is delegated to state update callbacks");
        }
      } catch (error) {
        console.error("Error in bot turn:", error);
        setIsHumanTurn(true); // Safety fallback
      }
    } else {
      // Easy difficulty uses the predefined easyBotTurn function
      try {
        // easyBotTurn MUTATES the humanAttacked set passed to it
        const easyAttackedSet = new Set(latestHumanAttacked);
        const updatedQueue = easyBotTurn(
            humanBoard as number[][],
            easyAttackedSet, // Pass the mutable set
            botQueue,
            () => {
              // This callback is called when a hit occurs IN easyBotTurn
              hitShip = true;
              setBotHits((prev) => {
                const newHits = prev + 1;
                if (newHits >= TOTAL_SHIP_SQUARES) {
                  console.log("Game Over - Bot Wins!");
                  setGameOver(true);
                  setWinner("bot");
                }
                return newHits;
              });
            }
        );
        setBotQueue([...updatedQueue]);
        // Update the main state with the (potentially) mutated set from easyBotTurn
        setHumanAttacked(easyAttackedSet);

        // Update LEDs using the set AFTER easyBotTurn potentially modified it
        updateLEDsAfterTurn(humanBoard, botBoard, easyAttackedSet, currentBotAttacked);

        // Easy mode - go again if hit
        if (hitShip && !gameOver) {
          console.log("Easy bot hit a ship, going again after delay");
          // Pass the LATEST botAttacked and the UPDATED humanAttacked set (easyAttackedSet)
          setTimeout(() => botTurn(currentBotAttacked, easyAttackedSet), 1000);
        } else {
          console.log("Bot turn complete, returning control to player");
          setIsHumanTurn(true);
        }
      } catch (error) {
        console.error("Error in easy bot turn:", error);
        setIsHumanTurn(true); // Safety fallback
      }
    }
  };
  // temp code
  // Keep original voice attack handler
  // at top of your component, after voskRec is set
  // page.tsx (or wherever your handleVoiceAttack lives)
  const handleVoiceAttack = async () => {
    if (!isHumanTurn || gameOver) return;
    updateLEDsListening();
  
    try {
      // record 3s
      const blob = await recordAudio(3);
      const dataUrl = await blobToDataURL(blob);
  
      // send to API
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBlob: dataUrl })
      });
      if (!res.ok) throw new Error(await res.text());
      const { text } = await res.json();
      const coords = (text as string)
      .toUpperCase()
      .match(/([A-J])\s*(10|[1-9])/g);
      console.log("Transcribed:", coords)
      if (!coords?.length) {
        alert("Sorry, didn't catch a valid cell (e.g. A1). Try again.");
        return;
      }
      const coord = coords[0].replace(/\s+/, "");
      const row = "ABCDEFGHIJ".indexOf(coord[0]);
      const col = parseInt(coord.slice(1), 10) - 1;
      handleHumanClick(row, col);
  
    } catch (e: any) {
      alert('Voice attack failed: ' + e.message);
    }
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
  <div className="flex items-center justify-center h-screen bg-gray-100">
    <div className="bg-gray-800 text-white p-8 rounded-xl text-center shadow-xl max-w-md w-full">
      <h1 className="text-3xl font-extrabold mb-6">Play New Game</h1>
      <div className="grid grid-cols-2 gap-6">
        <button
          className="w-full py-4 rounded-lg bg-green-500 hover:bg-green-600 transition"
          onClick={() => setDifficulty("easy")}
        >
          Normal
        </button>
        <button
          className="w-full py-4 rounded-lg bg-orange-500 hover:bg-orange-600 transition"
          onClick={() => setDifficulty("medium")}
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
