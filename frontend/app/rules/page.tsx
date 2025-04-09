'use client'

import React from 'react';
import Link from 'next/link';

export default function RulesPage() {
    return (
        <main className="container mx-auto py-8 px-4 max-w-4xl">
            <h1 className="text-3xl font-bold text-center mb-8">Battleship Game Rules</h1>
            
            <div className="bg-white shadow-md rounded-lg p-6 mb-8">
                <h2 className="text-2xl font-bold mb-4">Game Overview</h2>
                <p className="mb-4">
                    Battleship is a classic strategy game where you try to sink all of your opponent's ships
                    before they sink yours. Each player has a fleet of 5 ships of different sizes, placed on a 10×10 grid.
                    Players take turns calling shots at the other player's grid, trying to hit and sink their ships.
                </p>
                <p>
                    In our version, you're playing against a computer opponent with three difficulty levels, and the game
                    integrates with a physical LED board via an ESP32 microcontroller.
                </p>
            </div>
            
            <div className="bg-white shadow-md rounded-lg p-6 mb-8">
                <h2 className="text-2xl font-bold mb-4">Ships</h2>
                <p className="mb-4">Each player has 5 ships of the following sizes:</p>
                <ul className="list-disc list-inside mb-4 ml-4">
                    <li>Carrier - 5 squares</li>
                    <li>Battleship - 4 squares</li>
                    <li>Cruiser - 3 squares</li>
                    <li>Submarine - 3 squares</li>
                    <li>Destroyer - 2 squares</li>
                </ul>
                <p>
                    Ships are placed horizontally or vertically, never diagonally, and they cannot overlap each other.
                </p>
            </div>
            
            <div className="bg-white shadow-md rounded-lg p-6 mb-8">
                <h2 className="text-2xl font-bold mb-4">Game Setup</h2>
                <ol className="list-decimal list-inside mb-4 ml-4">
                    <li className="mb-2">Start by taking a photo of your physical board setup, or use the test mode for a random setup.</li>
                    <li className="mb-2">Confirm your board image to proceed to the next step.</li>
                    <li className="mb-2">Select a difficulty level:
                        <ul className="list-disc list-inside ml-8 mt-1">
                            <li><strong>Easy:</strong> Bot selects targets randomly but will continue attacking around successful hits.</li>
                            <li><strong>Medium:</strong> Bot uses probability to make more intelligent guesses.</li>
                            <li><strong>Hard:</strong> Bot uses advanced probability and when it hits a ship, it will uncover the entire ship.</li>
                        </ul>
                    </li>
                </ol>
            </div>
            
            <div className="bg-white shadow-md rounded-lg p-6 mb-8">
                <h2 className="text-2xl font-bold mb-4">Gameplay</h2>
                <ol className="list-decimal list-inside mb-4 ml-4">
                    <li className="mb-2">Click on the opponent's board to attack a square.</li>
                    <li className="mb-2">
                        <strong>Hit:</strong> If you hit an enemy ship, the square will turn green and you get another turn.
                    </li>
                    <li className="mb-2">
                        <strong>Miss:</strong> If you miss, the square will turn red and it becomes the opponent's turn.
                    </li>
                    <li className="mb-2">The bot will then attack your board.</li>
                    <li className="mb-2">Players alternate turns until someone wins.</li>
                    <li className="mb-2">First player to sink all enemy ships (17 total squares) wins!</li>
                </ol>
            </div>
            
            <div className="bg-white shadow-md rounded-lg p-6 mb-8">
                <h2 className="text-2xl font-bold mb-4">Physical Board Integration</h2>
                <p className="mb-4">
                    This game interfaces with a physical LED board through an ESP32 microcontroller:
                </p>
                <ul className="list-disc list-inside mb-4 ml-4">
                    <li className="mb-2">The LED board shows the status of both game boards.</li>
                    <li className="mb-2">The ESP32 camera can be used to scan your physical ship layout.</li>
                    <li className="mb-2">The game updates the physical LEDs after each turn.</li>
                </ul>
                <p className="mb-4">
                    LED colors on the physical board:
                </p>
                <ul className="list-disc list-inside mb-4 ml-4">
                    <li><strong className="text-blue-500">Blue:</strong> Unattacked water</li>
                    <li><strong className="text-red-500">Red:</strong> Missed shot</li>
                    <li><strong className="text-green-500">Green:</strong> Hit ship</li>
                </ul>
            </div>
            
            <div className="bg-white shadow-md rounded-lg p-6 mb-8">
                <h2 className="text-2xl font-bold mb-4">Tips</h2>
                <ul className="list-disc list-inside mb-4 ml-4">
                    <li className="mb-2">Try to hunt in a pattern to maximize your chances of hitting ships.</li>
                    <li className="mb-2">When you hit a ship, try attacking adjacent squares to find the rest of it.</li>
                    <li className="mb-2">The bot in medium and hard difficulties uses probability to make smarter moves.</li>
                    <li className="mb-2">Be careful with the hard difficulty - once the bot hits one square of your ship, it will find the entire ship!</li>
                </ul>
            </div>
            
            <div className="text-center mt-8">
                <Link href="/game" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg">
                    Start Playing
                </Link>
                <Link href="/" className="ml-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg">
                    Back to Home
                </Link>
            </div>
        </main>
    );
}