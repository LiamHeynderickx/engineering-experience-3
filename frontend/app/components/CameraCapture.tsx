'use client'

import React, { useState } from 'react';
import { CameraState } from '../types/game';

interface CameraCaptureProps {
  cameraState: CameraState;
  setCameraImage: (image: string | null) => void;
  setImageConfirmed: (confirmed: boolean) => void;
  setUseTestImage: (useTest: boolean) => void;
  onCapture: () => Promise<string | null>;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({
  cameraState,
  setCameraImage,
  setImageConfirmed,
  setUseTestImage,
  onCapture
}) => {
  const { cameraImage, imageConfirmed, useTestImage } = cameraState;
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCaptureClick = async () => {
    setIsCapturing(true);
    try {
      const image = await onCapture();
      if (image) {
        setCameraImage(image);
      }
    } catch (error) {
      console.error('Failed to capture image:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleConfirmImage = () => {
    setImageConfirmed(true);
  };

  const handleTestModeToggle = () => {
    setUseTestImage(!useTestImage);
  };

  const handleResetImage = () => {
    setCameraImage(null);
    setImageConfirmed(false);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Battleship Board Setup</h2>
      
      {/* Camera viewfinder with styling */}
      <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-inner border-2 border-gray-700">
        {/* Camera grid overlay for alignment */}
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="w-full h-full grid grid-cols-3 grid-rows-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="border border-white border-opacity-20"></div>
            ))}
          </div>
          <div className="absolute inset-0 border-2 border-blue-500 border-opacity-50"></div>
        </div>
        
        {cameraImage ? (
          <img 
            src={cameraImage} 
            alt="Captured Board" 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isCapturing ? (
              <div className="camera-processing">
                <div className="scanning-line"></div>
                <p className="text-white mt-4 animate-pulse">Capturing image...</p>
              </div>
            ) : (
              <div className="text-gray-400 flex flex-col items-center">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-12 w-12 mb-2" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
                  />
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" 
                  />
                </svg>
                Position your physical board in view
              </div>
            )}
          </div>
        )}
        
        {/* Camera flash animation when capturing */}
        {isCapturing && (
          <div className="absolute inset-0 bg-white animate-flash"></div>
        )}
      </div>
      
      {/* Controls section */}
      <div className="w-full">
        {cameraImage ? (
          <div className="flex flex-col items-center gap-3">
            {!imageConfirmed ? (
              <>
                <p className="text-gray-700 text-center">
                  Is your board correctly positioned in the image?
                </p>
                <div className="flex gap-3">
                  <button
                    className="btn btn-success"
                    onClick={handleConfirmImage}
                  >
                    <span className="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Confirm
                    </span>
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleResetImage}
                  >
                    <span className="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Retake
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-green-100 text-green-800 p-3 rounded-lg text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-semibold">Image Confirmed!</p>
                <p className="text-sm">Select a difficulty to start the game</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-3">
              <button
                className="btn btn-primary"
                onClick={handleCaptureClick}
                disabled={isCapturing}
              >
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  Capture Board
                </span>
              </button>
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              <div className="relative inline-block w-10 mr-2 align-middle select-none">
                <input 
                  type="checkbox" 
                  id="testModeToggle" 
                  checked={useTestImage}
                  onChange={handleTestModeToggle}
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 border-gray-300 appearance-none cursor-pointer transition-transform duration-200 ease-in-out"
                />
                <label 
                  htmlFor="testModeToggle" 
                  className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"
                ></label>
              </div>
              <label htmlFor="testModeToggle" className="text-gray-700 cursor-pointer select-none">
                Use Test Mode
              </label>
            </div>
            
            <p className="text-xs text-gray-500 mt-1 max-w-xs text-center">
              {useTestImage 
                ? "Test mode will use a sample board layout instead of capturing from the camera." 
                : "Position your physical board in view of the camera and click Capture."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraCapture; 