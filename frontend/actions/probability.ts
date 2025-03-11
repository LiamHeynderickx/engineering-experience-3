import { createMatrix, addMatrices } from "./helpers";

const BOARD_SIZE = 10;

// Calculate probabilities for a specific ship length given the current boards.
// boardHits: a 10x10 matrix with 1 for a hit, 0 otherwise.
// boardMisses: a 10x10 matrix with a nonzero value (for example, 1 or 2) for a miss, 0 otherwise.
export function possibleLocationsProbability(
  boardHits: number[][],
  boardMisses: number[][],
  shipLength: number
): number[][][] {
  const listOfProbabilities: number[][][] = [];

  // Check rows:
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col <= BOARD_SIZE - shipLength; col++) {
      let emptySlotCount = 0;
      const positionsWithHits: number[] = [];
      // Check each cell in the candidate segment
      for (let k = col; k < col + shipLength; k++) {
        if (boardMisses[row][k] === 0) {
          emptySlotCount++;
          if (boardHits[row][k] === 1) {
            positionsWithHits.push(k);
          }
        }
      }
      if (emptySlotCount === shipLength) {
        // Create a new 10x10 probability matrix for this placement.
        const newState = createMatrix(BOARD_SIZE, BOARD_SIZE, 0);
        const hitMultiplier =
          positionsWithHits.length > 0 ? 4 * positionsWithHits.length : 1;
        // For cells in the candidate segment: if already hit, probability is 0; else set to shipLength * multiplier.
        for (let k = col; k < col + shipLength; k++) {
          if (!positionsWithHits.includes(k)) {
            newState[row][k] = shipLength * hitMultiplier;
          } else {
            newState[row][k] = 0;
          }
        }
        listOfProbabilities.push(newState);
      }
    }
  }

  // Check columns:
  for (let col = 0; col < BOARD_SIZE; col++) {
    for (let row = 0; row <= BOARD_SIZE - shipLength; row++) {
      let emptySlotCount = 0;
      const positionsWithHits: number[] = [];
      for (let k = row; k < row + shipLength; k++) {
        if (boardMisses[k][col] === 0) {
          emptySlotCount++;
          if (boardHits[k][col] === 1) {
            positionsWithHits.push(k);
          }
        }
      }
      if (emptySlotCount === shipLength) {
        const newState = createMatrix(BOARD_SIZE, BOARD_SIZE, 0);
        // Here, if there is any hit, multiplier is 4; otherwise 1.
        const hitMultiplier = positionsWithHits.length > 0 ? 4 : 1;
        for (let k = row; k < row + shipLength; k++) {
          if (!positionsWithHits.includes(k)) {
            newState[k][col] = shipLength * hitMultiplier;
          } else {
            newState[k][col] = 0;
          }
        }
        listOfProbabilities.push(newState);
      }
    }
  }
  return listOfProbabilities;
}

// Generate overall probabilities for all ships.
// ships is an array of ship lengths; default standard battleship sizes.
export function generateProbabilitiesForAllShips(
  boardHits: number[][],
  boardMisses: number[][],
  ships: number[] = [5, 4, 3, 3, 2]
): number[][] {
  let finalMatrix = createMatrix(BOARD_SIZE, BOARD_SIZE, 0);
  for (const shipLength of ships) {
    const probMatrices = possibleLocationsProbability(
      boardHits,
      boardMisses,
      shipLength
    );
    for (const matrix of probMatrices) {
      finalMatrix = addMatrices(finalMatrix, matrix);
    }
  }
  return finalMatrix;
}

// Given the probability matrix, choose the cell with the maximum probability.
// Returns an object with row and col.
export function generateNextMove(probMatrix: number[][]): {
  row: number;
  col: number;
} {
  let maxVal = -Infinity;
  let bestRow = 0;
  let bestCol = 0;
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (probMatrix[i][j] > maxVal) {
        maxVal = probMatrix[i][j];
        bestRow = i;
        bestCol = j;
      }
    }
  }
  return { row: bestRow, col: bestCol };
}
