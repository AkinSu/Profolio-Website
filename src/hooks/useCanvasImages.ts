import { useState, useCallback } from 'react';

export interface CanvasImageData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}

export function useCanvasImages() {
  const [images, setImages] = useState<CanvasImageData[]>([]);

  const addImage = useCallback((src: string, naturalWidth: number, naturalHeight: number, x: number, y: number) => {
    // Default display width 300, scale height to keep aspect ratio
    const displayWidth = 300;
    const displayHeight = (naturalHeight / naturalWidth) * displayWidth;
    const img: CanvasImageData = {
      id: crypto.randomUUID(),
      x: x - displayWidth / 2,
      y: y - displayHeight / 2,
      width: displayWidth,
      height: displayHeight,
      rotation: 0,
      src,
      naturalWidth,
      naturalHeight,
    };
    setImages((prev) => [...prev, img]);
    return img.id;
  }, []);

  const updateImage = useCallback((id: string, updates: Partial<CanvasImageData>) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, ...updates } : img)));
  }, []);

  const deleteImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  return { images, setImages, addImage, updateImage, deleteImage };
}
