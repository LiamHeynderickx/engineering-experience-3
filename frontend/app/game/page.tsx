"use client";
import React, { useState, useEffect } from "react";
import { generateBoard } from "../../actions/functions";
import { botTurn as easyBotTurn } from "../../actions/functions";
import {
  generateProbabilitiesForAllShips,
  generateNextMove,
} from "../../actions/probability";
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

export default function GamePage() {
  // ─── Your existing state & logic ─────────────────────────────────────────
  const [gameStarted, setGameStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<
    "easy" | "medium" | "hard" | null
  >(null);

  const [cameraImage, setCameraImage] = useState<string | null>(null);
  const [imageConfirmed, setImageConfirmed] = useState(false);
  const [useTestImage, setUseTestImage] = useState(false);

  const [botGrid, setBotGrid] = useState<string[][]>(
    Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill("blue"))
  );
  const [botBoard, setBotBoard] = useState<(number | string)[][]>([]);
  const [humanBoard, setHumanBoard] = useState<(number | string)[][]>([]);

  const [humanHits, setHumanHits] = useState(0);
  const [botHits, setBotHits] = useState(0);
  const [isHumanTurn, setIsHumanTurn] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<"human" | "bot" | null>(null);

  const [botAttacked, setBotAttacked] = useState<Set<string>>(new Set());
  const [humanAttacked, setHumanAttacked] = useState<Set<string>>(new Set());

  const [botQueue, setBotQueue] = useState<{ x: number; y: number }[]>([]);

  const [boardProbHits, setBoardProbHits] = useState(
    createMatrix(GRID_SIZE, GRID_SIZE, 0)
  );
  const [boardProbMisses, setBoardProbMisses] = useState(
    createMatrix(GRID_SIZE, GRID_SIZE, 0)
  );

  // Voice recognizer setup (unchanged)
  let recognizer: any = null;
  if (typeof window !== "undefined") {
    const Speech =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (Speech) {
      recognizer = new Speech();
      recognizer.lang = "en-US";
      recognizer.interimResults = false;
      recognizer.maxAlternatives = 1;
    }
  }
  const handleVoiceAttack = () => {
    if (!isHumanTurn || !recognizer || !difficulty || gameOver) return;
    recognizer.onstart = () => console.log("🎤 Listening...");
    recognizer.onresult = (evt: any) => {
      const txt = evt.results[0][0].transcript
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
      console.log("Heard:", txt);
      const m = txt.match(/^([A-J])([1-9]|10)$/);
      if (!m) return alert("Invalid cell – try again!");
      const col = "ABCDEFGHIJ".indexOf(m[1]);
      const row = parseInt(m[2], 10) - 1;
      handleHumanClick(row, col);
    };
    recognizer.onerror = (e: any) => {
      console.error(e);
      alert("Speech error – try again.");
    };
    recognizer.start();
  };

  // ─── Image capture + board setup ──────────────────────────────────────────
  useEffect(() => {
    if (!difficulty) return;
    const useHard = difficulty === "hard";
    const bot = generateBoard(useHard);
    setBotBoard(bot);

    if (cameraImage) {
      processCapturedImage(cameraImage)
        .then((matrix) => {
          if (Array.isArray(matrix)) setHumanBoard(matrix);
          else setHumanBoard(generateBoard(useHard));
        })
        .catch(() => setHumanBoard(generateBoard(useHard)));
    } else {
      setHumanBoard(generateBoard(useHard));
    }

    setBotGrid(
      Array(GRID_SIZE)
        .fill(null)
        .map(() => Array(GRID_SIZE).fill("blue"))
    );
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
  }, [difficulty, cameraImage]);

  async function processCapturedImage(imgUrl: string) {
    const res = await fetch(imgUrl);
    const blob = await res.blob();
    const base64 = await new Promise<string>((r) => {
      const fr = new FileReader();
      fr.onloadend = () => r(fr.result as string);
      fr.readAsDataURL(blob);
    });
    const api = await fetch("/api/processBoard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64 }),
    });
    return api.ok ? api.json() : null;
  }

  async function captureImage() {
    if (useTestImage) return "/testImage.jpg";
    const resp = await fetch("/api/captureImage");
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  }

  // ─── Click handler & bot turn logic (unchanged) ───────────────────────────
  function handleHumanClick(row: number, col: number) {
    if (!isHumanTurn || !difficulty || gameOver) return;
    const key = `${col},${row}`;
    if (botAttacked.has(key)) return;
    botAttacked.add(key);
    if (botBoard[row][col] !== 0) {
      setHumanHits((h) => {
        const nh = h + 1;
        if (nh >= TOTAL_SHIP_SQUARES) {
          setGameOver(true);
          setWinner("human");
        }
        return nh;
      });
      setBotGrid((g) =>
        g.map((r, i) =>
          r.map((c, j) => (i === row && j === col ? "green" : c))
        )
      );
    } else {
      setBotGrid((g) =>
        g.map((r, i) =>
          r.map((c, j) => (i === row && j === col ? "red" : c))
        )
      );
    }
    updateLEDsAfterTurn(humanBoard, botBoard, humanAttacked, botAttacked);
    setIsHumanTurn(false);
    setTimeout(runBotTurn, 800);
  }

  function runBotTurn() {
    if (gameOver) return;
    // … your entire medium/hard/easy branches here, exactly as before …
    setIsHumanTurn(true);
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        {/* ───── camera section swapped ───── */}
        <div className="relative w-full max-w-md aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-inner border-2 border-gray-700">
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="w-full h-full grid grid-cols-3 grid-rows-3">
              {[...Array(9)].map((_, i) => (
                <div
                  key={i}
                  className="border border-white border-opacity-20"
                ></div>
              ))}
            </div>
            <div className="absolute inset-0 border-2 border-blue-500 border-opacity-50"></div>
          </div>
          {cameraImage ? (
            <img
              src={cameraImage}
              className="w-full h-full object-cover"
            />
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

  if (!imageConfirmed) return null;

  if (!difficulty) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-gray-800 text-white p-6 rounded-lg text-center shadow-lg">
          <h1 className="text-2xl font-bold mb-4">Play New Game</h1>
          <div className="grid grid-cols-3 gap-4">
            {/* ─── difficulty swapped ─── */}
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
      {/* Voice + turn indicator unchanged */}
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

      {/* ─── bot board swapped ─── */}
      <div className="flex gap-6">
        <div className="p-2 bg-gradient-to-b from-blue-800 to-blue-600 rounded-lg shadow-xl">
          <h2 className="text-white text-lg mb-2 text-center">
            Enemy Waters
          </h2>
          <div className="grid grid-cols-10 gap-0.5 bg-black p-2 rounded-lg">
            {botGrid.map((row, r) =>
              row.map((cell, c) => {
                const key = `${c},${r}`;
                const attacked = botAttacked.has(key);
                return (
                  <div
                    key={key}
                    className={`w-10 h-10 rounded-lg cursor-pointer transition-colors ${
                      cell === "blue"
                        ? "bg-blue-500"
                        : cell === "green"
                        ? "bg-green-500"
                        : "bg-red-500"
                    } ${attacked ? "opacity-80 cursor-not-allowed" : ""}`}
                    onClick={() => handleHumanClick(r, c)}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* ─── your board swapped ─── */}
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
