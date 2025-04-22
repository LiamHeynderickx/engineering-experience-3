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
    const boardData = JSON.parse(stdout);

    // Optionally delete the temporary image.
    fs.unlinkSync(tempImagePath);

    return NextResponse.json(boardData);
  } catch (error: any) {
    console.error('Error in POST /api/processBoard:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
