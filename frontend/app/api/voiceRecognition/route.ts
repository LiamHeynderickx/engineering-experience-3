import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  return new Promise<NextResponse>((resolve, reject) => {
    // point at your Python file
    const script = path.join(
      process.cwd(),
      "app",
      "api",
      "voiceRecognition",
      "OldVoiceRecog.py"
    );
    const py = spawn("python", ["-u", script]);
    let out = "";

    py.stdout.on("data", (chunk) => {
      out += chunk.toString();
    });

    py.on("error", reject);

    py.on("close", () => {
      const coord = out.trim();
      if (coord === "error") {
        resolve(
          NextResponse.json({ error: "Could not understand voice" }, { status: 400 })
        );
        return;
      }
      // A5 → letter A, number 5 → col 0, row 4
      const letter = coord.charAt(0).toUpperCase();
      const num = parseInt(coord.slice(1), 10);
      const letters = "ABCDEFGHIJ";
      const col = letters.indexOf(letter);
      const row = num - 1;
      if (col < 0 || row < 0 || row > 9) {
        resolve(
          NextResponse.json({ error: "Invalid coordinate" }, { status: 400 })
        );
      } else {
        resolve(NextResponse.json({ row, col }));
      }
    });
  });
}
