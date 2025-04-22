// app/api/sendLedData/route.ts
import { NextRequest, NextResponse } from 'next/server';
import net from 'net';

const ESP32_IP = '192.168.4.1';  // Replace with your ESP32 IP address
const ESP32_PORT = 8080;         // Replace with your ESP32 listening port

let espClient: net.Socket | null = null;
let isConnected = false;

const connectToESP32 = () => {
  return new Promise<void>((resolve, reject) => {
    if (isConnected && espClient) {
      resolve();
      return;
    }

    espClient = new net.Socket();
    espClient.setTimeout(2000);

    espClient.connect(ESP32_PORT, ESP32_IP, () => {
      console.log('Connected to ESP32');
      isConnected = true;
      resolve();
    });

    espClient.on('error', (err) => {
      console.error('ESP32 connection error:', err.message);
      isConnected = false;
      espClient = null;
      reject(err);
    });

    espClient.on('close', () => {
      console.log('ESP32 connection closed');
      isConnected = false;
      espClient = null;
    });

    espClient.on('timeout', () => {
      console.error('ESP32 connection timed out');
      isConnected = false;
      espClient?.destroy();
      espClient = null;
      reject(new Error('Connection timed out'));
    });
  });
};

const sendToESP32 = async (ledArray: number[]) => {
  try {
    await connectToESP32();

    if (!espClient || !isConnected) {
      throw new Error('Not connected to ESP32');
    }

    const data = JSON.stringify({ leds: ledArray });
    espClient.write(data);
    return 'LED data sent to ESP32';
  } catch (error) {
    throw error;
  }
};

export async function POST(req: NextRequest) {
  try {
    const { ledArray } = await req.json();
    console.log("Received LED array:", ledArray);
    const result = await sendToESP32(ledArray);
    return NextResponse.json({ message: result });
  } catch (error) {
    console.error("Error handling LED data:", error);
    return NextResponse.json({ error: 'Failed to send data to ESP32' }, { status: 500 });
  }
}