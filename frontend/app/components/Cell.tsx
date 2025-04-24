'use client'

import React, { useState, useEffect } from 'react';
import { CellState } from '../types/game';

interface CellProps {
  state: CellState;
  row: number;
  col: number;
  onClick: (row: number, col: number) => void;
  disabled: boolean;
  shipType?: string | number;
  shipVisible?: boolean;
  isHit?: boolean;
  isHorizontal?: boolean;
  shipPosition?: 'start' | 'middle' | 'end' | 'single';
  isSunk?: boolean;
}

const Cell: React.FC<CellProps> = ({ 
  state, 
  row, 
  col, 
  onClick, 
  disabled, 
  shipType, 
  shipVisible = false,
  isHit = false,
  isHorizontal = true,
  shipPosition = 'middle',
  isSunk = false
}) => {
  const [animating, setAnimating] = useState(false);
  const [hitAnimating, setHitAnimating] = useState(false);

  useEffect(() => {
    // When cell changes to green (hit), trigger hit animation
    if (state === 'green' && !animating) {
      setHitAnimating(true);
      setTimeout(() => setHitAnimating(false), 1000);
    }
  }, [state, animating]);

  const handleClick = () => {
    if (!disabled && !animating) {
      setAnimating(true);
      
      // Simple hit effect - immediately call handler and show animation
      onClick(row, col);
      
      // Reset animation state after it completes
      setTimeout(() => {
        setAnimating(false);
      }, 800);
    }
  };

  // Cell appearance based on state
  let cellClasses = 'relative w-10 h-10 transition-all';
  let overlayClasses = '';
  let contentClasses = '';
  
  // Apply hit or miss styles
  if (state === 'red') {
    // Miss styling - blue water with X
    cellClasses += ' bg-blue-400 border border-blue-500';
    overlayClasses = 'absolute inset-0 bg-blue-300 opacity-20';
    contentClasses = 'miss-marker bg-opacity-60';
  } else if (state === 'green') {
    // Hit styling - handled by the ship element when visible
    if (!shipVisible) {
      // Only show hit marker when ships aren't visible
      cellClasses += ' bg-blue-400 border border-blue-500';
      overlayClasses = 'absolute inset-0 flex items-center justify-center';
      contentClasses = 'hit-marker';
    } else {
      // Style is handled by the ship element
      cellClasses += ' bg-blue-400 border border-blue-500';
      overlayClasses = 'absolute inset-0 bg-blue-300 opacity-20';
    }
  } else {
    // Base water appearance for blue cells
    cellClasses += ' bg-blue-400 border border-blue-500';
    // Add wave pattern to water cells
    cellClasses += ' overflow-hidden';
    overlayClasses = 'absolute inset-0 bg-blue-300 opacity-20';
    contentClasses = 'wave-pattern';
  }

  // Ship element to display
  let shipElement = null;

  // Apply ship styling when visible
  if (shipVisible && shipType && shipType.toString() !== '0') {
    let shipClass = 'absolute inset-0 flex items-center justify-center';
    let shipContent = null;
    
    // Add special effects for sunk ships - more prominent styling
    if (isSunk) {
      shipClass += ' ship-sunk animate-pulse'; // Add animation to make it more noticeable
    }
    
    // Base ship color - black when not hit, red when hit, and distinct gray when sunk
    const shipColor = isSunk 
      ? 'bg-gray-700 border-gray-800 ring-4 ring-red-300' // Add a ring to make sunk ships stand out
      : isHit 
        ? 'bg-red-700' 
        : 'bg-gray-900';
    
    // Determine which part of the ship to display based on position
    if (shipPosition === 'start') {
      shipContent = isHorizontal ? (
        <div className={`ship-part ship-bow-horizontal ${shipColor}`}></div>
      ) : (
        <div className={`ship-part ship-bow-vertical ${shipColor}`}></div>
      );
    } else if (shipPosition === 'end') {
      shipContent = isHorizontal ? (
        <div className={`ship-part ship-stern-horizontal ${shipColor}`}></div>
      ) : (
        <div className={`ship-part ship-stern-vertical ${shipColor}`}></div>
      );
    } else if (shipPosition === 'single') {
      shipContent = (
        <div className={`ship-part ship-single ${shipColor}`}></div>
      );
    } else {
      // Middle section
      shipContent = isHorizontal ? (
        <div className={`ship-part ship-middle-horizontal ${shipColor}`}></div>
      ) : (
        <div className={`ship-part ship-middle-vertical ${shipColor}`}></div>
      );
    }
    
    shipElement = (
      <div className={shipClass}>
        {shipContent}
        {isHit && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            {/* Hit marker for when individual ships are hit - centered better */}
            <div className={`absolute w-6 h-6 rounded-full ${isSunk ? 'bg-gray-500' : 'bg-red-500'} opacity-80 ${isSunk ? '' : 'animate-pulse'}`}></div>
            {!isSunk && (
              <div className="smoke-effect">
                <div className="smoke smoke-1"></div>
                <div className="smoke smoke-2"></div>
                <div className="smoke smoke-3"></div>
              </div>
            )}
          </div>
        )}
        {/* Add a "SUNK" indicator for sunk ships that aren't hit */}
        {isSunk && !isHit && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="absolute w-4 h-4 rounded-full bg-gray-500 opacity-50"></div>
          </div>
        )}
      </div>
    );
  }
  
  // Cursor style when interactive
  if (disabled) {
    if (state === 'red' || state === 'green') {
      // Cell was already attacked
      cellClasses += ' cursor-not-allowed opacity-100';
    } else {
      // Cell is disabled for other reasons
      cellClasses += ' cursor-not-allowed opacity-80';
    }
  } else {
    // Interactive cell
    cellClasses += ' cursor-crosshair hover:brightness-90 hover:scale-105 transition-transform';
  }

  return (
    <div
      className={cellClasses}
      onClick={handleClick}
    >
      {/* Water pattern overlay */}
      <div className={overlayClasses}></div>
      
      {/* Ship graphics */}
      {shipElement}
      
      {/* Content (hit/miss markers) */}
      <div className={contentClasses}>
        {state === 'green' && !shipVisible && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Hit marker - red circle with smoke effect */}
            <div className="absolute w-6 h-6 rounded-full bg-red-600 animate-pulse"></div>
            <div className="smoke-effect">
              <div className="smoke smoke-1"></div>
              <div className="smoke smoke-2"></div>
              <div className="smoke smoke-3"></div>
            </div>
          </div>
        )}
        {state === 'red' && !isHit && (
          <div className="absolute inset-0 flex items-center justify-center miss-marker">
            {/* Clear X mark for miss - using SVG for precision */}
            <svg width="22" height="22" viewBox="0 0 22 22" className="miss-x">
              <line x1="4" y1="4" x2="18" y2="18" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <line x1="18" y1="4" x2="4" y2="18" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>
      
      {/* Simplified hit animation - just a flash effect */}
      {animating && (
        <div className="absolute inset-0 z-20">
          <div className="absolute inset-0 bg-white animate-hitFlash"></div>
        </div>
      )}
      
      {/* Hit ripple effect */}
      {hitAnimating && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-4 h-4 rounded-full bg-red-500 animate-hitRipple"></div>
        </div>
      )}
    </div>
  );
};

export default Cell; 