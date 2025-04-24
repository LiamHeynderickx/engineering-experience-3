// hooks/useGameState.ts
"use client";

import { useState, useEffect } from "react";
import { generateBoard } from "../../actions/functions";
import { botTurn as easyBotTurn } from "../../actions/functions";
import { generateProbabilitiesForAllShips, generateNextMove } from "../../actions/probability";
import { createMatrix } from "../../actions/helpers";
import { updateLEDsAfterTurn } from "../../actions/connectionTCP";

export type Difficulty = "easy" | "medium" | "hard";

export interface GameState {
  gameStarted: boolean;
  difficulty: Difficulty | null;
  botBoard: (number | string)[][];
  humanBoard: (number | string)[][];
  botGrid: string[][];
  humanAttacked: Set<string>;
  botAttacked: Set<string>;
  humanHits: number;
  botHits: number;
  isHumanTurn: boolean;
  gameOver: boolean;
  winner: "human" | "bot" | null;
  sunkEnemyShips: Set<string | number>;
}

interface UseGameState {
  state: GameState;
  selectDifficulty: (diff: Difficulty) => void;
  restartGame: () => void;
  handleHumanAttack: (row: number, col: number) => void;
}

export function useGameState(
  cameraImage: string | null,
  imageConfirmed: boolean
): UseGameState {
  const GRID = 10;
  const TOTAL = 17;

  // Core state
  const [gameStarted, setGameStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);

  const [botBoard, setBotBoard]       = useState<(number | string)[][]>([]);
  const [humanBoard, setHumanBoard]   = useState<(number | string)[][]>([]);
  const [botGrid, setBotGrid]         = useState<string[][]>(
    Array(GRID).fill([]).map(() => Array(GRID).fill("blue"))
  );

  const [humanAttacked, setHumanAttacked] = useState<Set<string>>(new Set());
  const [botAttacked, setBotAttacked]     = useState<Set<string>>(new Set());

  const [humanHits, setHumanHits] = useState(0);
  const [botHits, setBotHits]     = useState(0);

  const [isHumanTurn, setIsHumanTurn] = useState(true);
  const [gameOver, setGameOver]       = useState(false);
  const [winner, setWinner]           = useState<"human"|"bot"|null>(null);

  const [boardProbHits, setBoardProbHits]   = useState<number[][]>(createMatrix(GRID, GRID, 0));
  const [boardProbMisses, setBoardProbMisses] = useState<number[][]>(createMatrix(GRID, GRID, 0));
  const [botQueue, setBotQueue]             = useState<{x:number,y:number}[]>([]);

  const [sunkEnemyShips, setSunkEnemyShips] = useState<Set<string|number>>(new Set());

  // 1️⃣ Start or restart the game
  const selectDifficulty = (diff: Difficulty) => {
    setDifficulty(diff);
    setGameStarted(true);
  };
  const restartGame = () => {
    setGameStarted(false);
    setDifficulty(null);
    setWinner(null);
    setHumanHits(0);
    setBotHits(0);
  };

  // 2️⃣ Initialize boards once we actually start
  useEffect(() => {
    if (!gameStarted || !difficulty) return;

    const useHard = difficulty === "hard";
    const bBoard = generateBoard(useHard);
    setBotBoard(bBoard);
    setBotGrid(Array(GRID).fill([]).map(() => Array(GRID).fill("blue")));

    setHumanHits(0);
    setBotHits(0);
    setBotAttacked(new Set());
    setHumanAttacked(new Set());
    setBotQueue([]);
    setBoardProbHits(createMatrix(GRID, GRID, 0));
    setBoardProbMisses(createMatrix(GRID, GRID, 0));
    setIsHumanTurn(true);
    setGameOver(false);
    setWinner(null);
  }, [gameStarted, difficulty]);

  // 3️⃣ Once the user has confirmed their board image, run your Python endpoint
  useEffect(() => {
    if (!gameStarted || !imageConfirmed || !cameraImage) return;

    (async () => {
      try {
        // fetch the blob → convert to base64 → POST to /api/processBoard
        const blob = await (await fetch(cameraImage)).blob();
        const dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onloadend = () => res(r.result as string);
          r.onerror   = rej;
          r.readAsDataURL(blob);
        });
        const resp = await fetch("/api/processBoard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: dataUrl }),
        });
        if (!resp.ok) throw new Error(await resp.text());
        const matrix: number[][] = await resp.json();
        setHumanBoard(matrix);
      } catch (e) {
        console.error("Board OCR failed, falling back to random", e);
        setHumanBoard(generateBoard(difficulty === "hard"));
      }
    })();
  }, [gameStarted, imageConfirmed, cameraImage, difficulty]);

  // 4️⃣ Sunk‐ship detection
  function checkSunkShips(board: (string|number)[][], attacked: Set<string>) {
    const lengths: Record<string,number> = {};
    const hits:    Record<string,number> = {};
    // count total cells per ship
    board.forEach((row,y) => row.forEach((id,x) => {
      const key = `${id}`;
      if (id!==0 && id!=="") lengths[key] = (lengths[key]||0) + 1;
      const coord = `${x},${y}`;
      if ((id!==0 && id!=="") && attacked.has(coord)) hits[key] = (hits[key]||0) + 1;
    }));
    return new Set(
      Object.keys(lengths)
        .filter(id => hits[id] === lengths[id])
    );
  }
  useEffect(() => {
    setSunkEnemyShips(checkSunkShips(botBoard, botAttacked));
  }, [botBoard, botAttacked]);

  // 5️⃣ Handle a human attack + fire LEDs + schedule bot turn
  const handleHumanAttack = (row: number, col: number) => {
    if (!isHumanTurn || gameOver) return;
    const key = `${col},${row}`;
    if (botAttacked.has(key)) return;
    const nextBotAtt = new Set(botAttacked).add(key);
    setBotAttacked(nextBotAtt);

    // hit or miss?
    if (botBoard[row][col] !== 0) {
      setHumanHits(h => {
        const nh = h+1;
        if (nh >= TOTAL) { setGameOver(true); setWinner("human"); }
        return nh;
      });
      setBotGrid(g => g.map((r,i)=>r.map((c,j)=>i===row&&j===col?"green":c)));
    } else {
      setBotGrid(g => g.map((r,i)=>r.map((c,j)=>i===row&&j===col?"red":c)));
    }

    updateLEDsAfterTurn(humanBoard, botBoard, humanAttacked, nextBotAtt);
    setIsHumanTurn(false);

    // bot’s turn in 1s
    setTimeout(() => {
      if (gameOver) return;
      if (difficulty === "medium" || difficulty === "hard") {
        const prob = generateProbabilitiesForAllShips(boardProbHits, boardProbMisses);
        const { row: r, col: c } = generateNextMove(prob);
        const hit = humanBoard[r][c] !== 0;
        if (hit) {
          setBotHits(h => {
            const nh = h+1;
            if (nh>=TOTAL) { setGameOver(true); setWinner("bot"); }
            return nh;
          });
          if (difficulty === "hard") {
            // uncover entire boat logic...
            const boatId = humanBoard[r][c];
            const newBoard = humanBoard.map(rw=>[...rw]);
            let adds = 0;
            for (let y=0;y<GRID;y++) for (let x=0;x<GRID;x++){
              if (newBoard[y][x]===boatId) {
                newBoard[y][x]=0;
                const coord=`${x},${y}`;
                if (!humanAttacked.has(coord)) { adds++; humanAttacked.add(coord); }
              }
            }
            setHumanBoard(newBoard);
            setHumanAttacked(new Set(humanAttacked));
          } else {
            // medium
            const hitsM = boardProbHits.map(r=>[...r]);
            hitsM[r][c] = 1; setBoardProbHits(hitsM);
            humanAttacked.add(`${c},${r}`);
            setHumanAttacked(new Set(humanAttacked));
          }
        } else {
          // miss
          const missM = boardProbMisses.map(r=>[...r]);
          missM[r][c] = 1; setBoardProbMisses(missM);
          humanAttacked.add(`${c},${r}`);
          setHumanAttacked(new Set(humanAttacked));
        }
      } else {
        // easy
        const q = easyBotTurn(humanBoard as number[][], humanAttacked, botQueue, () => {
          setBotHits(h => {
            const nh = h+1;
            if (nh>=TOTAL) { setGameOver(true); setWinner("bot"); }
            return nh;
          });
        });
        setBotQueue([...q]);
      }

      updateLEDsAfterTurn(humanBoard, botBoard, humanAttacked, botAttacked);
      setIsHumanTurn(true);
    }, 1000);
  };

  return {
    state: {
      gameStarted, difficulty, botBoard, humanBoard, botGrid,
      humanAttacked, botAttacked, humanHits, botHits,
      isHumanTurn, gameOver, winner, sunkEnemyShips
    },
    selectDifficulty,
    restartGame,
    handleHumanAttack,
  };
}
