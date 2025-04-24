// hooks/useCameraState.ts
"use client";

import { useState } from "react";

export interface CameraState {
  cameraImage: string | null;
  imageConfirmed: boolean;
  useTestImage: boolean;
}

export function useCameraState() {
  const [cameraImage, setCameraImage] = useState<string | null>(null);
  const [imageConfirmed, setImageConfirmed] = useState(false);
  const [useTestImage, setUseTestImage] = useState(false);

  // Call this to actually grab an image (or return a test image)
  const captureImage = async (): Promise<string | null> => {
    if (useTestImage) {
      // put your sample board in public/testImage.jpg
      return "/testImage.jpg";
    }
    try {
      const res = await fetch("/api/captureImage");
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error("Error capturing image:", err);
      return null;
    }
  };

  return {
    cameraState: { cameraImage, imageConfirmed, useTestImage } as CameraState,
    setCameraImage,
    setImageConfirmed,
    setUseTestImage,
    captureImage,
  };
}
