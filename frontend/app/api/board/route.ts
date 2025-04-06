// app/api/boardData/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const execPromise = promisify(exec);

export async function GET(req: NextRequest) {
  try {
    // For this example, assume the image is available at a given URL.
    // Alternatively, your ESP can push the image to a known local folder.
    const imageUrl = 'http://192.168.4.1/capture'; // Adjust to the actual URL.
    
    // Download the image from the ESP camera.
    const res = await fetch(imageUrl);
    if (!res.ok) {
      throw new Error('Failed to fetch image from ESP camera');
    }
    const arrayBuffer = await res.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    
    // Save the image to a temporary file.
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir);
    }
    const tempImagePath = path.join(tmpDir, 'capture.jpg');
    fs.writeFileSync(tempImagePath, imageBuffer);
    
    // Run the Python script with the temporary image as input.
    // Adjust the path to process_board.py if needed.
    const { stdout, stderr } = await execPromise(`python process_board.py --image "${tempImagePath}"`);
    if (stderr) {
      console.error('Python error:', stderr);
    }
    
    // Parse the JSON output from the Python script.
    const boardData = JSON.parse(stdout);
    
    // Optionally delete the temporary image.
    fs.unlinkSync(tempImagePath);
    
    return NextResponse.json(boardData);
  } catch (error: any) {
    console.error('Error in GET /api/boardData:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
