'use client'

import React, { useState } from 'react';
import { Difficulty } from '../types/game';

interface GameControlsProps {
  gameStarted: boolean;
  difficulty: Difficulty;
  winner: 'human' | 'bot' | null;
  humanHits: number;
  botHits: number;
  onSelectDifficulty: (difficulty: Difficulty) => void;
  onRestart: () => void;
}

const GameControls: React.FC<GameControlsProps> = ({
  gameStarted,
  difficulty,
  winner,
  humanHits,
  botHits,
  onSelectDifficulty,
  onRestart
}) => {
  const totalShipSquares = 17; // 5 + 4 + 3 + 3 + 2 = 17
  const [hoveredDifficulty, setHoveredDifficulty] = useState<string | null>(null);
  
  const difficultyInfo = {
    easy: { 
      name: 'Easy',
      color: 'bg-green-600',
      hoverColor: 'hover:bg-green-700',
      description: 'The bot will attack randomly, but focus on areas around successful hits.'
    },
    medium: { 
      name: 'Medium',
      color: 'bg-yellow-500',
      hoverColor: 'hover:bg-yellow-600',
      description: 'The bot uses probability to make smarter attack decisions.'
    },
    hard: { 
      name: 'Hard',
      color: 'bg-red-600',
      hoverColor: 'hover:bg-red-700',
      description: 'Very difficult! The bot uses advanced strategies and reveals entire ships when it gets a hit.'
    }
  };

  const handleDifficultySelect = (selectedDifficulty: Difficulty) => {
    onSelectDifficulty(selectedDifficulty);
  };

  const getDifficultyButton = (difficultyKey: 'easy' | 'medium' | 'hard') => {
    const info = difficultyInfo[difficultyKey];
    const isSelected = difficulty === difficultyKey;
    const isHovered = hoveredDifficulty === difficultyKey;
    
    return (
      <div className="flex flex-col items-center">
        <div className="relative">
          <button
            className={`
              w-full px-5 py-3 rounded-lg font-bold text-white shadow-md transform transition-all
              ${info.color} ${info.hoverColor}
              ${isSelected ? 'ring-2 ring-blue-400 scale-105' : 'hover:scale-102'}
            `}
            onClick={() => handleDifficultySelect(difficultyKey)}
            onMouseEnter={() => setHoveredDifficulty(difficultyKey)}
            onMouseLeave={() => setHoveredDifficulty(null)}
          >
            {info.name}
          </button>
          
          {/* Tooltip on hover */}
          {isHovered && !isSelected && (
            <div className="absolute w-48 bg-gray-800 text-white text-xs rounded-md py-2 px-3 z-50 bottom-full mb-2 left-1/2 transform -translate-x-1/2 shadow-lg pointer-events-none">
              <div className="relative">
                <p>{info.description}</p>
                <div className="absolute w-3 h-3 bg-gray-800 transform rotate-45 left-1/2 -ml-1.5 -bottom-1.5"></div>
              </div>
            </div>
          )}
        </div>
        
        {/* Description shown permanently when selected */}
        {isSelected && (
          <p className="mt-2 text-sm text-gray-600 max-w-xs text-center">
            {info.description}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={`rounded-lg transition-all duration-300 ${gameStarted ? 'bg-gray-800 text-white' : 'bg-white'}`}>
      {!gameStarted ? (
        <div className="flex flex-col items-center p-4">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Choose Difficulty</h2>
          
          <div className="grid grid-cols-3 gap-2 w-full">
            {getDifficultyButton('easy')}
            {getDifficultyButton('medium')}
            {getDifficultyButton('hard')}
          </div>
          
          {difficulty && (
            <div className="mt-4 animate-pulse">
              <p className="text-blue-600 font-bold text-sm">Ready to start! Confirm your board image to begin.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-lg">Difficulty:</span>
                <span 
                  className={`
                    px-3 py-1 rounded-full text-white font-bold relative
                    ${difficultyInfo[difficulty as keyof typeof difficultyInfo]?.color || 'bg-blue-600'}
                  `}
                  onMouseEnter={() => setHoveredDifficulty(difficulty as string)}
                  onMouseLeave={() => setHoveredDifficulty(null)}
                >
                  {difficultyInfo[difficulty as keyof typeof difficultyInfo]?.name || difficulty}
                  
                  {/* Tooltip for difficulty in game */}
                  {hoveredDifficulty === difficulty && (
                    <div className="absolute w-48 bg-gray-900 text-white text-xs rounded-md py-2 px-3 z-50 bottom-full mb-2 left-1/2 transform -translate-x-1/2 shadow-lg pointer-events-none">
                      <div className="relative">
                        <p>{difficultyInfo[difficulty as keyof typeof difficultyInfo]?.description}</p>
                        <div className="absolute w-3 h-3 bg-gray-900 transform rotate-45 left-1/2 -ml-1.5 -bottom-1.5"></div>
                      </div>
                    </div>
                  )}
                </span>
              </div>
              
              {/* Progress bars for hits */}
              <div className="space-y-2 max-w-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Your hits</span>
                    <span className="text-sm font-medium">{humanHits}/{totalShipSquares}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div 
                      className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${(humanHits / totalShipSquares) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Bot hits</span>
                    <span className="text-sm font-medium">{botHits}/{totalShipSquares}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div 
                      className="bg-red-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${(botHits / totalShipSquares) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            
            {winner && (
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-3 rounded-lg text-center transform transition-all animate-bounce">
                <h3 className="text-xl font-bold mb-1 text-white drop-shadow">
                  {winner === 'human' ? '🎉 Victory! 🎉' : '☠️ Defeated! ☠️'}
                </h3>
                <p className="text-white mb-2 text-sm">
                  {winner === 'human' 
                    ? "You've sunk all enemy ships!" 
                    : "All your ships have been sunk!"}
                </p>
                <button
                  className="px-4 py-1 bg-white text-gray-900 rounded hover:bg-gray-100 font-bold text-sm"
                  onClick={onRestart}
                >
                  Play Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameControls; 