const GRID_SIZE = 10;

/**
 * Generates a random board with 0 for empty and 1 for a ship cell.
 * Places ships with proper spacing between them.
 */
// functions.ts (partial)

export function generateBoard(hard: boolean = false): (number | string)[][] {
  const board = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(0)
  );

  if (hard) {
    // For hard mode, ships are objects with a length and a unique id.
    const ships: { length: number; id: string }[] = [
      { length: 5, id: "5" },
      { length: 4, id: "4" },
      { length: 3, id: "3a" },
      { length: 3, id: "3b" },
      { length: 2, id: "2" },
    ];
    ships.forEach(({ length, id }) => {
      let placed = false;
      let attempts = 0;
      const maxAttempts = 100; // Prevent infinite loops
      
      while (!placed && attempts < maxAttempts) {
        attempts++;
        const orientation = Math.random() > 0.5 ? "horizontal" : "vertical";
        const x = Math.floor(Math.random() * GRID_SIZE);
        const y = Math.floor(Math.random() * GRID_SIZE);
        
        // Check if we can place the ship with spacing around it
        if (canPlaceShipWithSpacing(board, x, y, length, orientation)) {
          // Place the ship
          for (let i = 0; i < length; i++) {
            if (orientation === "horizontal") {
              board[y][x + i] = id;
            } else {
              board[y + i][x] = id;
            }
          }
          placed = true;
        }
      }
      
      // If we couldn't place after max attempts, try without spacing check as fallback
      if (!placed) {
        placed = placeShipWithoutSpacing(board, length, id);
      }
    });
  } else {
    // For normal (non-hard) mode, ships are just numbers.
    const ships: number[] = [5, 4, 3, 3, 2];
    ships.forEach((shipLength) => {
      let placed = false;
      let attempts = 0;
      const maxAttempts = 100; // Prevent infinite loops
      
      while (!placed && attempts < maxAttempts) {
        attempts++;
        const orientation = Math.random() > 0.5 ? "horizontal" : "vertical";
        const x = Math.floor(Math.random() * GRID_SIZE);
        const y = Math.floor(Math.random() * GRID_SIZE);
        
        // Check if we can place the ship with spacing around it
        if (canPlaceShipWithSpacing(board, x, y, shipLength, orientation)) {
          // Place the ship
          for (let i = 0; i < shipLength; i++) {
            if (orientation === "horizontal") {
              board[y][x + i] = 1;
            } else {
              board[y + i][x] = 1;
            }
          }
          placed = true;
        }
      }
      
      // If we couldn't place after max attempts, try without spacing check as fallback
      if (!placed) {
        placed = placeShipWithoutSpacing(board, shipLength, 1);
      }
    });
  }

  console.log("Generated board:", board);
  return board;
}

/**
 * Checks if a ship can be placed at the given position with proper spacing around it.
 * Ships should not touch each other, even diagonally.
 */
function canPlaceShipWithSpacing(
  board: (number | string)[][],
  startX: number,
  startY: number,
  length: number,
  orientation: string
): boolean {
  // Check boundaries
  if (orientation === "horizontal") {
    if (startX + length > GRID_SIZE) return false;
  } else {
    if (startY + length > GRID_SIZE) return false;
  }
  
  // Check area around the ship (including diagonals)
  const minY = Math.max(0, startY - 1);
  const maxY = orientation === "horizontal" 
    ? Math.min(GRID_SIZE - 1, startY + 1)
    : Math.min(GRID_SIZE - 1, startY + length);
  
  const minX = Math.max(0, startX - 1);
  const maxX = orientation === "horizontal"
    ? Math.min(GRID_SIZE - 1, startX + length)
    : Math.min(GRID_SIZE - 1, startX + 1);
  
  // Check the surrounding area
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (board[y][x] !== 0) {
        return false; // Another ship is too close
      }
    }
  }
  
  return true;
}

/**
 * Fallback method to place a ship without spacing requirements
 * Used only if we failed to place with spacing after multiple attempts
 */
function placeShipWithoutSpacing(
  board: (number | string)[][],
  shipLength: number,
  shipId: string | number
): boolean {
  let placed = false;
  let attempts = 0;
  const maxAttempts = 200;
  
  while (!placed && attempts < maxAttempts) {
    attempts++;
    const orientation = Math.random() > 0.5 ? "horizontal" : "vertical";
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    let canPlace = true;
    
    // Check boundaries and collisions
    if (orientation === "horizontal") {
      if (x + shipLength > GRID_SIZE) canPlace = false;
      else {
        for (let i = 0; i < shipLength; i++) {
          if (board[y][x + i] !== 0) canPlace = false;
        }
      }
    } else {
      if (y + shipLength > GRID_SIZE) canPlace = false;
      else {
        for (let i = 0; i < shipLength; i++) {
          if (board[y + i][x] !== 0) canPlace = false;
        }
      }
    }
    
    if (canPlace) {
      for (let i = 0; i < shipLength; i++) {
        if (orientation === "horizontal") board[y][x + i] = shipId;
        else board[y + i][x] = shipId;
      }
      placed = true;
    }
  }
  
  return placed;
}

/**
 * The bot makes ONE attack per turn.
 * - It first checks the uncoverQueue; if there's any square there that hasn't been attacked, it uses it.
 * - Otherwise, it randomly picks a new square.
 * The loop ensures the bot keeps trying until it finds a square that wasn't already attacked.
 * If it hits, adjacent squares are added to the queue for future turns.
 *
 * @param humanBoard       The human's board (array of 0/1).
 * @param attackedSquares  A set of squares the bot has already attacked ("x,y").
 * @param uncoverQueue     A queue of { x, y } squares the bot wants to uncover in future turns.
 * @param onBotHit         Callback to increment the bot's hit count.
 * @returns The updated uncoverQueue.
 */
export function botTurn(
  humanBoard: number[][],
  attackedSquares: Set<string>,
  uncoverQueue: { x: number; y: number }[],
  onBotHit: () => void
): { x: number; y: number }[] {
  let candidate: { x: number; y: number } | null = null;
  let attempts = 0;
  const maxAttempts = 500; // Safeguard to avoid infinite loops

  // Keep trying until we find a candidate that wasn't attacked
  while (!candidate && attempts < maxAttempts) {
    if (uncoverQueue.length > 0) {
      const next = uncoverQueue.shift()!;
      const key = `${next.x},${next.y}`;
      if (!attackedSquares.has(key)) {
        candidate = next;
        console.log(
          `Bot continuing to uncover a ship at ${candidate.x}, ${candidate.y} (from queue).`
        );
      } else {
        console.log(`Queue item ${key} was already attacked. Skipping it.`);
      }
    } else {
      // If queue is empty, pick a random square
      const rx = Math.floor(Math.random() * GRID_SIZE);
      const ry = Math.floor(Math.random() * GRID_SIZE);
      const rKey = `${rx},${ry}`;
      if (!attackedSquares.has(rKey)) {
        candidate = { x: rx, y: ry };
        console.log(`Bot picking random square at ${rx}, ${ry}.`);
      }
    }
    attempts++;
  }

  if (!candidate) {
    console.log(
      "Bot could not find any new squares to attack. Possibly game over."
    );
    return uncoverQueue;
  }

  // Attack the chosen candidate
  const { x: pickX, y: pickY } = candidate;
  const key = `${pickX},${pickY}`;
  attackedSquares.add(key);
  console.log(`Bot attacking at ${pickX}, ${pickY}`);
  const result = humanBoard[pickY][pickX];

  if (result === 1 || typeof result === 'string') {
    console.log(
      `Bot hit at ${pickX}, ${pickY}. Adding adjacent squares for future turns.`
    );
    onBotHit();
    uncoverQueue = addAdjacentSquares(
      pickX,
      pickY,
      attackedSquares,
      uncoverQueue
    );
  } else {
    console.log(`Bot missed at ${pickX}, ${pickY}`);
  }

  return uncoverQueue;
}

/**
 * Adds the four adjacent squares (N, S, W, E) to the queue if they are in bounds
 * and haven't already been attacked.
 */
function addAdjacentSquares(
  x: number,
  y: number,
  attacked: Set<string>,
  queue: { x: number; y: number }[]
): { x: number; y: number }[] {
  const directions = [
    { dx: 0, dy: -1 }, // North
    { dx: 0, dy: 1 }, // South
    { dx: -1, dy: 0 }, // West
    { dx: 1, dy: 0 }, // East
  ];

  for (const { dx, dy } of directions) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
      const key = `${nx},${ny}`;
      if (!attacked.has(key)) {
        console.log(
          `  -> Queueing adjacent square ${nx}, ${ny} for future turns.`
        );
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return queue;
}
