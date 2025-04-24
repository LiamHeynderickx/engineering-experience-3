'use client'

import React from 'react';
import Cell from './Cell';
import { CellState, GameBoard as GameBoardType } from '../types/game';

interface GameBoardProps {
  grid: CellState[][];
  onCellClick: (row: number, col: number) => void;
  disabled: boolean;
  title: string;
  board?: GameBoardType;
  attackedCells?: Set<string>;
  showShips?: boolean;
  sunkShips?: Set<string | number>;
}

// Helper to determine ship orientation and position
const getShipPosition = (
  board: GameBoardType,
  rowIndex: number, 
  colIndex: number
): { isHorizontal: boolean; position: 'start' | 'middle' | 'end' | 'single' } => {
  const shipType = board[rowIndex][colIndex];
  // Check if the cell has a ship (any non-zero value)
  if (!shipType || shipType.toString() === '0') return { isHorizontal: true, position: 'single' };
  
  // Check if it's a single cell ship
  const hasLeft = colIndex > 0 && board[rowIndex][colIndex-1] === shipType;
  const hasRight = colIndex < board[0].length-1 && board[rowIndex][colIndex+1] === shipType;
  const hasUp = rowIndex > 0 && board[rowIndex-1][colIndex] === shipType;
  const hasDown = rowIndex < board.length-1 && board[rowIndex+1][colIndex] === shipType;
  
  // Determine orientation
  const isHorizontal = hasLeft || hasRight;
  
  // Determine position
  if (isHorizontal) {
    if (hasLeft && hasRight) return { isHorizontal, position: 'middle' };
    if (hasLeft) return { isHorizontal, position: 'end' };
    if (hasRight) return { isHorizontal, position: 'start' };
    return { isHorizontal, position: 'single' };
  } else {
    if (hasUp && hasDown) return { isHorizontal, position: 'middle' };
    if (hasUp) return { isHorizontal, position: 'end' };
    if (hasDown) return { isHorizontal, position: 'start' };
    return { isHorizontal, position: 'single' };
  }
};

const GameBoard: React.FC<GameBoardProps> = ({ 
  grid, 
  onCellClick, 
  disabled, 
  title,
  board = [],
  attackedCells = new Set(),
  showShips = false,
  sunkShips = new Set()
}) => {
  // Column labels (A-J)
  const columnLabels = Array.from({ length: 10 }, (_, i) => String.fromCharCode(65 + i));
  
  // Row labels (1-10)
  const rowLabels = Array.from({ length: 10 }, (_, i) => (i + 1).toString());

  // Check if we have any ships in the sunkShips set
  const hasSunkShips = sunkShips.size > 0;

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl font-bold mb-2 text-gray-800">{title}</h2>
      {hasSunkShips && (
        <div className="mb-2 px-2 py-1 bg-green-200 text-green-800 rounded text-xs">
          Sunk ships will be displayed
        </div>
      )}
      
      <div className="game-board-container p-6 bg-gradient-to-b from-blue-800 to-blue-600 rounded-lg shadow-xl">
        {/* Column labels */}
        <div className="grid grid-cols-11 gap-1 mb-1">
          <div className="w-6 h-6"></div>
          {columnLabels.map(label => (
            <div key={`col-${label}`} className="w-10 h-6 flex items-center justify-center text-white font-semibold text-sm">
              {label}
            </div>
          ))}
        </div>
        
        {/* Row labels + Grid */}
        <div className="grid grid-rows-10 gap-1">
          {grid.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} className="flex gap-1">
              {/* Row label */}
              <div className="w-6 h-10 flex items-center justify-center text-white font-semibold text-sm">
                {rowLabels[rowIndex]}
              </div>
              
              {/* Cells */}
              {row.map((cell, colIndex) => {
                const key = `${colIndex},${rowIndex}`;
                const isAttacked = attackedCells.has(key);
                const shipType = board[rowIndex]?.[colIndex];
                
                // Make sure we have a valid string representation for comparison
                const shipTypeStr = shipType !== undefined && shipType !== null ? 
                  shipType.toString() : '';
                
                // Check if this ship is in the sunkShips Set by comparing string representations
                const shipIsSunk = 
                  shipTypeStr !== '' && 
                  shipTypeStr !== '0' && 
                  sunkShips.size > 0 &&
                  Array.from(sunkShips).some(id => id.toString() === shipTypeStr);
                
                // Show ship if:
                // 1. showShips is true (game over or player board) OR
                // 2. The ship is marked as sunk (this makes ALL cells of that ship visible)
                const shouldShowShip = showShips || 
                  (shipTypeStr !== '' && 
                   shipTypeStr !== '0' && 
                   sunkShips.size > 0 &&
                   Array.from(sunkShips).some(id => id.toString() === shipTypeStr));
                
                // Get ship orientation and position information
                const { isHorizontal, position } = 
                  (shouldShowShip && shipType && shipType.toString() !== '0' && board.length > 0) ? 
                  getShipPosition(board, rowIndex, colIndex) : 
                  { isHorizontal: true, position: 'single' as const };
                
                // Determine if this cell has a ship that was hit
                const isHit = !!(isAttacked && shipType && shipType.toString() !== '0');
                
                // Add visual cue for cells that have already been attacked
                const isAlreadyAttacked = attackedCells.has(key);
                
                return (
                  <Cell
                    key={`${rowIndex}-${colIndex}`}
                    state={cell}
                    row={rowIndex}
                    col={colIndex}
                    onClick={onCellClick}
                    disabled={disabled || isAlreadyAttacked}
                    shipType={shipType}
                    shipVisible={shouldShowShip}
                    isHit={isHit}
                    isHorizontal={isHorizontal}
                    shipPosition={position}
                    isSunk={shipIsSunk}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      {/* Board compass decoration */}
      <div className="mt-4 w-16 h-16 rounded-full bg-gray-100 border-4 border-gray-300 relative shadow-md">
        <div className="compass-rose absolute inset-0 flex items-center justify-center">
          <div className="compass-needle h-10 w-2 bg-gradient-to-b from-red-500 to-blue-500 rounded-full transform rotate-45"></div>
          <div className="absolute w-4 h-4 rounded-full bg-gray-700"></div>
        </div>
      </div>
    </div>
  );
};

export default GameBoard; 