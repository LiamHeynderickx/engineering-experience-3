// app/api/sendLedData/route.ts
import { NextRequest, NextResponse } from 'next/server';
import net from 'net';

const ESP32_IP = '192.168.4.1';  // Replace with your ESP32 IP address
const ESP32_PORT = 8080;         // Replace with your ESP32 listening port

let espClient: net.Socket | null = null;
let isConnected = false;
let connectionPromise: Promise<void> | null = null;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

const connectToESP32 = (): Promise<void> => {
  if (isConnected && espClient) {
    return Promise.resolve();
  }

  // If a connection attempt is already in progress, return that promise
  if (connectionPromise) {
    return connectionPromise;
  }

  // Start a new connection attempt
  connectionPromise = new Promise((resolve, reject) => {
    if (espClient) {
      console.log("Destroying existing non-connected client before reconnecting...");
      espClient.destroy();
      espClient = null;
    }
    
    console.log(`Attempting to connect to ESP32 at ${ESP32_IP}:${ESP32_PORT}...`);
    espClient = net.createConnection({ host: ESP32_IP, port: ESP32_PORT }, () => {
      console.log('Connected to ESP32');
      isConnected = true;
      connectionPromise = null; // Clear the promise once connected
      // Set a default timeout after connection is established
      espClient?.setTimeout(5000); // 5 second timeout for writes
      resolve();
    });

    espClient.on('error', (err) => {
      console.error('ESP32 connection error:', err);
      isConnected = false;
      espClient?.destroy(); // Ensure socket is destroyed on error
      espClient = null;
      connectionPromise = null; // Clear promise on error
      reject(err);
    });

    espClient.on('close', () => {
      console.log('ESP32 connection closed');
      isConnected = false;
      espClient = null;
      connectionPromise = null; // Clear promise on close
      // Decide if you want to automatically reject or let subsequent calls retry
    });

    espClient.on('timeout', () => {
      console.error('ESP32 socket timeout (likely during write)');
      isConnected = false;
      espClient?.destroy();
      espClient = null;
      connectionPromise = null; // Clear promise on timeout
      reject(new Error('Socket timeout')); // Reject promise on timeout
    });

    // Add a connection timeout specifically for the initial connection attempt
    espClient.setTimeout(3000, () => { // 3 seconds to connect
        if (!isConnected) {
            console.error('ESP32 connection attempt timed out.');
            espClient?.destroy();
            espClient = null;
            connectionPromise = null;
            reject(new Error('Connection attempt timed out'));
        }
    });

  });

  return connectionPromise;
};

const sendToESP32 = async (ledArray: number[], retries = MAX_RETRIES): Promise<string> => {
  try {
    await connectToESP32(); // Ensure connection is attempted/established

    if (!espClient || !isConnected) {
      throw new Error('Not connected to ESP32 after connection attempt.');
    }

    const data = JSON.stringify({ leds: ledArray });
    console.log("Sending data to ESP32:", data.substring(0, 100) + "..."); // Log snippet
    
    return new Promise((resolve, reject) => {
      if (!espClient) return reject(new Error("Client became null unexpectedly"));

      espClient.write(data + '\n', (err) => { // Add newline as delimiter if ESP expects it
          if (err) {
              console.error('Error writing to ESP32:', err);
              isConnected = false; // Assume connection is broken
              espClient?.destroy();
              espClient = null;
              return reject(err);
          }
          console.log("Data written to ESP32 successfully.");
          resolve('LED data sent to ESP32');
      });
      
      // Add a specific timeout for the write operation itself
      const writeTimeout = setTimeout(() => {
          console.error('ESP32 write operation timed out.');
          isConnected = false;
          espClient?.destroy();
          espClient = null;
          reject(new Error('Write operation timed out'));
      }, 2000); // 2 seconds for write

      // Clear timeout if write completes successfully (or errors)
      // Need to handle this carefully, perhaps using event listeners for 'drain' or relying on write callback
      // For simplicity, we'll rely on the write callback clearing/resolving/rejecting before timeout
      // **Note:** This simple timeout clear might not be robust in all scenarios.
      espClient.once('error', () => clearTimeout(writeTimeout)); 
      espClient.once('close', () => clearTimeout(writeTimeout));
      // Consider clearing on 'drain' if dealing with backpressure
    });

  } catch (error: any) { // Catch connection errors or initial state errors
    console.warn(`Send attempt failed: ${error.message}. Retries left: ${retries - 1}`);
    if (retries > 1) {
      connectionPromise = null; // Allow reconnect attempt
      isConnected = false;
      if(espClient) {
        espClient.destroy();
        espClient = null;
      }
      await delay(RETRY_DELAY_MS);
      return sendToESP32(ledArray, retries - 1); // Retry
    } else {
      console.error("Max retries reached. Failed to send data to ESP32.");
      throw error; // Throw error after max retries
    }
  }
};

// Helper function for delays (if not already present)
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const { ledArray } = await req.json();
    // console.log("Received LED array in POST:", ledArray); // Less verbose logging
    const result = await sendToESP32(ledArray); // Call the retry-enabled function
    return NextResponse.json({ message: result });
  } catch (error: any) {
    console.error("Error handling LED data in POST:", error.message);
    // Return specific error message if available
    return NextResponse.json({ error: `Failed to send data to ESP32: ${error.message}` }, { status: 500 });
  }
}