// connectionTCP.ts

export function generateLEDArray(humanBoard: (number | string)[][], botBoard: (number | string)[][], humanAttacked: Set<string>, botAttacked: Set<string>) {
    const ledArray = [];
    
    // Process human board (first 100 elements)
    for (let i = 0; i < 100; i++) {
      const row = Math.floor(i / 10);
      const col = i % 10;
      const key = `${col},${row}`; // key for tracking attacked cells
      
      if (humanAttacked.has(key)) {
        if (humanBoard[row][col]  !== 0 || typeof humanBoard[row][col] === "string") {
          // Hit on the human's board (Boat hit)
          ledArray.push(2);
        } else {
          // Miss on the human's board
          ledArray.push(1);
        }
      } else {
        // Tile has not been attacked yet
        ledArray.push(3);
      }
    }
  
    // Process bot board (last 100 elements)
    for (let i = 100; i < 200; i++) {
      const row = Math.floor((i - 100) / 10);
      const col = (i - 100) % 10;
      const key = `${col},${row}`; // key for tracking attacked cells
      
      if (botAttacked.has(key)) {
        if (botBoard[row][col] === 1 || typeof botBoard[row][col] === "string") {
          // Hit on the bot's board (Boat hit)
          ledArray.push(2);
        } else {
          // Miss on the bot's board
          ledArray.push(1);
        }
      } else {
        // Tile has not been attacked yet
        ledArray.push(3);
      }
    }
  
    return ledArray;
  }
  
  // Function to update LEDs by calling the API route
  // connectionTCP.ts

export function updateLEDsAfterTurn(humanBoard: (number | string)[][], botBoard: (number | string)[][], humanAttacked: Set<string>, botAttacked: Set<string>) {
    const ledArray = generateLEDArray(humanBoard, botBoard, humanAttacked, botAttacked);
    console.log("Generated LED Array:", ledArray);  // Log the generated LED array

    // Send the ledArray to the API route
    fetch('/api/sendLedData', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ledArray }),
    })
        .then((response) => {
            console.log('Response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            console.log('LED data sent:', data.message);
        })
        .catch((error) => {
            console.error('Error sending LED data:', error);
            console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        });
}
  
// connectionTCP.ts

/**
 * Generate a 200-element array filled with 6 (yellow),
 * to indicate "listening" feedback on all LEDs.
 */
export function generateListeningLEDArray(): number[] {
  return Array(200).fill(6);
}

/**
 * Send that "listening" array to the back end.
 * Call this right when you kick off speech recognition.
 */
export function updateLEDsListening(): void {
  const ledArray = generateListeningLEDArray();
  console.log("Listening LED Array:", ledArray);

  fetch('/api/sendLedData', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ledArray }),
  })
    .then(res => {
      console.log('Listening LEDs sent, status', res.status);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => console.log('Response:', data.message))
    .catch(err => console.error('Error sending listening LEDs:', err));
}
  
// --- Game Over LED Patterns ---

const FLASH_DELAY_MS = 500; // Delay between flashes (milliseconds)
const FLASH_COUNT = 3; // Number of times to flash

// Helper function to send LED data via fetch
async function sendLedDataAsync(ledArray: number[]): Promise<void> {
  try {
    const response = await fetch('/api/sendLedData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ledArray }),
    });
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, Body: ${errorData}`);
    }
    const data = await response.json();
    console.log('LED data sent:', data.message);
  } catch (error) {
    console.error('Error sending LED data:', error);
    // Optionally re-throw or handle further if needed
  }
}

// Helper function for delays
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate arrays for game over states
function generateVictoryLEDArray(): number[] {
  return Array(200).fill(2); // All Green
}

function generateDefeatLEDArray(): number[] {
  return Array(200).fill(1); // All Red
}

function generateOffLEDArray(): number[] {
  return Array(200).fill(0); // All Off
}

// Function to flash the Victory pattern
export async function updateLEDsVictory(): Promise<void> {
  console.log("Starting Victory LED flash sequence...");
  const victoryPattern = generateVictoryLEDArray();
  const offPattern = generateOffLEDArray();
  for (let i = 0; i < FLASH_COUNT; i++) {
    await sendLedDataAsync(victoryPattern);
    await delay(FLASH_DELAY_MS);
    await sendLedDataAsync(offPattern);
    await delay(FLASH_DELAY_MS);
  }
  console.log("Victory LED flash sequence complete.");
  // Optionally leave the victory pattern on after flashing
  // await sendLedDataAsync(victoryPattern);
}

// Function to flash the Defeat pattern
export async function updateLEDsDefeat(): Promise<void> {
  console.log("Starting Defeat LED flash sequence...");
  const defeatPattern = generateDefeatLEDArray();
  const offPattern = generateOffLEDArray();
  for (let i = 0; i < FLASH_COUNT; i++) {
    await sendLedDataAsync(defeatPattern);
    await delay(FLASH_DELAY_MS);
    await sendLedDataAsync(offPattern);
    await delay(FLASH_DELAY_MS);
  }
  console.log("Defeat LED flash sequence complete.");
  // Optionally leave the defeat pattern on after flashing
  // await sendLedDataAsync(defeatPattern);
}
  