// app/api/processBoard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const execPromise = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    // Expect a JSON payload with an imageBase64 property.
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      throw new Error("No imageBase64 provided");
    }

    // Remove the data URL prefix if present.
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Save the image to a temporary file.
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir);
    }
    const tempImagePath = path.join(tmpDir, 'captured.jpg');
    fs.writeFileSync(tempImagePath, imageBuffer);

    // Build an absolute path to your Python script.
    // For example, if your process_board.py is in app/api/processBoard:
    const scriptPath = path.join(
      process.cwd(),
      'app',
      'api',
      'processBoard',
      'process_board.py'
    );

    // Execute the Python script.
    const { stdout, stderr } = await execPromise(
      `python "${scriptPath}" --image "${tempImagePath}"`
    );
    if (stderr) {
      console.error('Python error:', stderr);
    }

    // Parse the JSON output from the Python script.
    let boardData = JSON.parse(stdout)
    boardData = boatsToMatrix(boardData)
    console.log("Board data:", boardData)

    // Optionally delete the temporary image.
    fs.unlinkSync(tempImagePath);

    return NextResponse.json(boardData);
  } catch (error: any) {
    console.error('Error in POST /api/processBoard:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

interface Boat {
  occupied_cells: [number, number][];
  size: number;
  orientation: "Horizontal" | "Vertical";
}

interface BoatsData {
  boats: Boat[];
}

/**
 * Translates the detected boats JSON into a 10×10 matrix
 * with 1s where boats occupy and 0s elsewhere.
 * @param data BoatsData containing boats with occupied cells
 * @returns A 10×10 number matrix
 */
function boatsToMatrix(data: BoatsData): number[][] {
  // Initialize a 10×10 grid of zeros
  const grid: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));

  data.boats.forEach((boat: Boat) => {
    boat.occupied_cells.forEach(([row, col]: [number, number]) => {
      if (row >= 0 && row < 10 && col >= 0 && col < 10) {
        grid[row][col] = 1;
      } else {
        console.warn(`Boat cell [${row},${col}] is out of bounds and will be ignored.`);
      }
    });
  });

  return grid;
}

