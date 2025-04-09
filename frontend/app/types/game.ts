// Game related types

export type Difficulty = 'easy' | 'medium' | 'hard' | null;

export type CellValue = 0 | 1 | string; // 0 = empty, 1 = ship, string = ship ID in hard mode

export type CellState = 'blue' | 'red' | 'green'; // blue = unknown, red = miss, green = hit

export type Coordinate = {
  x: number;
  y: number;
};

export type GameBoard = (CellValue)[][];

export type GameState = {
  gameStarted: boolean;
  difficulty: Difficulty;
  humanBoard: GameBoard;
  botBoard: GameBoard;
  botGrid: CellState[][]; // Visual representation of bot's board for human
  humanHits: number;
  botHits: number;
  isHumanTurn: boolean;
  gameOver: boolean;
  winner: 'human' | 'bot' | null;
  humanAttacked: Set<string>; // coordinates attacked by bot
  botAttacked: Set<string>; // coordinates attacked by human
  botQueue: Coordinate[]; // for easy bot strategy
  boardProbHits: number[][];
  boardProbMisses: number[][];
};

export type CameraState = {
  cameraImage: string | null;
  imageConfirmed: boolean;
  useTestImage: boolean;
}; 