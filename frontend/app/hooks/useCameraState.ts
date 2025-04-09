'use client'

import { useState } from 'react';
import { CameraState } from '../types/game';

export function useCameraState() {
  const [cameraState, setCameraState] = useState<CameraState>({
    cameraImage: null,
    imageConfirmed: false,
    useTestImage: false
  });

  // Destructure state for easier access
  const { cameraImage, imageConfirmed, useTestImage } = cameraState;

  // Update camera image
  const setCameraImage = (image: string | null) => {
    setCameraState(prev => ({
      ...prev,
      cameraImage: image
    }));
  };

  // Confirm or reject image
  const setImageConfirmed = (confirmed: boolean) => {
    setCameraState(prev => ({
      ...prev,
      imageConfirmed: confirmed
    }));
  };

  // Toggle test image mode
  const setUseTestImage = (useTest: boolean) => {
    setCameraState(prev => ({
      ...prev,
      useTestImage: useTest
    }));
  };

  // Capture image function
  const captureImage = async (): Promise<string | null> => {
    if (useTestImage) {
      // Return a test image URL from public folder
      return "/testImage.jpg";
    }
    
    try {
      const response = await fetch("/api/captureImage");
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      console.log("Image Blob:", blob);
      const imgUrl = URL.createObjectURL(blob);
      console.log("Image URL:", imgUrl);
      return imgUrl;
    } catch (error) {
      console.error("Camera error:", error);
      alert("Camera Error: Failed to capture image");
      return null;
    }
  };

  // Reset camera state
  const resetCameraState = () => {
    setCameraState({
      cameraImage: null,
      imageConfirmed: false,
      useTestImage: false
    });
  };

  return {
    cameraState,
    setCameraImage,
    setImageConfirmed,
    setUseTestImage,
    captureImage,
    resetCameraState
  };
} 