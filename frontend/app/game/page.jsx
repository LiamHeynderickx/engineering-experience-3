"use client";

import React from "react";
import Link from "next/link";
import GameBoard from "../components/GameBoard";
import GameControls from "../components/GameControls";
import CameraCapture from "../components/CameraCapture";
import VoiceRecognition from "../components/VoiceRecognition";
import ShipStatus from "../components/ShipStatus";
import { useCameraState } from "../hooks/useCameraState";
import { useGameState } from "../hooks/useGameState";

export default function GamePage() {
  // Camera setup hook
  const {
    cameraState,
    setCameraImage,
    setImageConfirmed,
    setUseTestImage,
    captureImage,
  } = useCameraState();

  // Game logic hook
  const {
    state: gameState,
    selectDifficulty,
    restartGame,
    handleHumanAttack,
  } = useGameState(cameraState.cameraImage, cameraState.imageConfirmed);

  // If game hasn't started, show setup
  if (!gameState.gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8">
        <CameraCapture
          cameraState={cameraState}
          setCameraImage={setCameraImage}
          setImageConfirmed={setImageConfirmed}
          setUseTestImage={setUseTestImage}
          onCapture={captureImage}
        />

        <GameControls
          gameStarted={gameState.gameStarted}
          difficulty={gameState.difficulty}
          winner={gameState.winner}
          humanHits={gameState.humanHits}
          botHits={gameState.botHits}
          onSelectDifficulty={selectDifficulty}
          onRestart={restartGame}
        />

        <Link href="/rules" className="mt-4 text-sm text-gray-600 underline">
          View Game Rules
        </Link>
      </div>
    );
  }

  // Game in progress or over
  return (
    <div className="game-container bg-gradient-to-b from-blue-50 to-gray-100 min-h-screen p-6">
      {/* Status & Voice */}
      <div className={`mb-6 p-4 rounded-lg shadow-lg border-2 ${gameState.isHumanTurn ? "bg-blue-100 border-blue-500" : "bg-red-100 border-red-500"}`}>
        <p className={`text-xl font-bold ${gameState.isHumanTurn ? "text-blue-800" : "text-red-800"}`}>
          {gameState.isHumanTurn
            ? "YOUR TURN - Click or use voice to attack"
            : "BOT'S TURN - Please wait..."}
        </p>
        {gameState.isHumanTurn && (
          <div className="mt-3 flex flex-col items-center">
            <VoiceRecognition
              onResult={(coord) => {
                const col = coord.charCodeAt(0) - 65;
                const row = parseInt(coord.slice(1), 10) - 1;
                handleHumanAttack(row, col);
              }}
              onError={(msg) => alert(msg)}
              isEnabled={gameState.isHumanTurn}
            />
          </div>
        )}
      </div>

      {/* Main boards */}
      <div className="flex flex-col lg:flex-row gap-8 justify-center">
        {/* Enemy board */}
        <div className="flex-1">
          <GameBoard
            grid={gameState.botGrid}
            onCellClick={handleHumanAttack}
            disabled={!gameState.isHumanTurn || gameState.gameOver}
            title="Enemy Waters"
            board={gameState.botBoard}
            attackedCells={gameState.botAttacked}
            showShips={gameState.gameOver}
            sunkShips={gameState.sunkEnemyShips}
          />
        </div>

        {/* Your board + status */}
        <div className="flex-1 space-y-6">
          <GameBoard
            grid={gameState.humanBoard.map((row, r) =>
              row.map((cell, c) =>
                gameState.humanAttacked.has(`${c},${r}`)
                  ? cell !== 0
                    ? "green"
                    : "red"
                  : "blue"
              )
            )}
            onCellClick={() => {}}
            disabled={true}
            title="Your Waters"
            board={gameState.humanBoard}
            attackedCells={gameState.humanAttacked}
            showShips={true}
          />

          <ShipStatus
            ships={Array.from(gameState.sunkEnemyShips).map((id) => {
              const nameMap = {
                "5": "Carrier",
                "4": "Battleship",
                "3a": "Cruiser",
                "3b": "Submarine",
                "2": "Destroyer",
              };
              return { id: String(id), name: nameMap[String(id)] || id, length: 0, hits: 0 };
            })}
            title="Sunk Enemy Ships"
          />
        </div>
      </div>

      {/* Footer controls */}
      <div className="mt-8 text-center">
        {gameState.gameOver && (
          <button
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
            onClick={restartGame}
          >
            Play Again
          </button>
        )}
        <Link href="/rules" className="ml-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Game Rules
        </Link>
      </div>
    </div>
  );
}
