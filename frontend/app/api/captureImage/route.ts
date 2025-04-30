// Example in app/api/captureImage/route.ts
import { NextRequest, NextResponse } from "next/server";
import net from "net";

const ESP32_IP = "192.168.207.221";  // Your ESP32 IP
const ESP32_PORT = 8080;         // Your ESP32 TCP port

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.connect(ESP32_PORT, ESP32_IP, () => {
      client.write("CAPTURE"); // Request image from ESP32
    });

    let imageData = Buffer.alloc(0);
    client.on("data", (data) => {
      imageData = Buffer.concat([imageData, data]);
    });

    client.on("end", () => {
      // The first 4 bytes are the image size; remove them.
      const fixedImageData = imageData.slice(4);
      resolve(
        new NextResponse(fixedImageData, {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        })
      );
    });

    client.on("error", (err) => {
      resolve(
        NextResponse.json({ error: `Failed to capture image: ${err.message}` }, { status: 500 })
      );
    });
  });
}
