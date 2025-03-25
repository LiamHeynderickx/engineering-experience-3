// app/api/sendLedData/route.ts
import { NextRequest, NextResponse } from 'next/server';
import net from 'net';

const ESP32_IP = '192.168.4.1';  // Replace with your ESP32 IP address
const ESP32_PORT = 8080;         // Replace with your ESP32 listening port

const sendToESP32 = (ledArray: number[]) => {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.connect(ESP32_PORT, ESP32_IP, () => {
      const data = JSON.stringify({ leds: ledArray });
      client.write(data); // Send the LED data to ESP32
      client.end(); // Close the connection
      resolve('LED data sent to ESP32');
    });

    client.on('error', (err) => {
      reject(`Error: ${err.message}`);
    });
  });
};

// Handle POST request to send LED data
export async function POST(req: NextRequest) {
  try {
    const { ledArray } = await req.json(); // Get LED array from the request body
    console.log("Received LED array:", ledArray);  // Log the received LED array
    const result = await sendToESP32(ledArray); // Send data to ESP32
    return NextResponse.json({ message: result });
  } catch (error) {
    console.error("Error handling LED data:", error);
    return NextResponse.json({ error: 'Failed to send data to ESP32' }, { status: 500 });
  }
}
