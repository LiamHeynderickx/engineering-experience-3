// connectionTCP.ts

export function generateLEDArray(humanBoard: (number | string)[][], botBoard: (number | string)[][], humanAttacked: Set<string>, botAttacked: Set<string>) {
    const ledArray = [];
    
    // Process human board (first 100 elements)
    for (let i = 0; i < 100; i++) {
      const row = Math.floor(i / 10);
      const col = i % 10;
      const key = `${col},${row}`; // key for tracking attacked cells
      
      if (humanAttacked.has(key)) {
        if (humanBoard[row][col] === 1 || typeof humanBoard[row][col] === "string") {
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
  
  