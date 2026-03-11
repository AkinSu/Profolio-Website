import { useState, useCallback } from 'react';

export interface CanvasTextButtonData {
  id: string;
  x: number;
  y: number;
  text: string;
  href: string;
  linkedElementId?: string;
  color: string;
  fontSize: number;
  bold: boolean;
  rotation: number;
  isEditing: boolean;
}

export interface CanvasImageButtonData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  href: string;
  linkedElementId?: string;
  naturalWidth: number;
  naturalHeight: number;
  isEditing: boolean;
}

export const BUTTON_COLORS = ['#292524', '#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#ca8a04'];

export function useCanvasButtons() {
  const [textButtons, setTextButtons] = useState<CanvasTextButtonData[]>([]);
  const [imageButtons, setImageButtons] = useState<CanvasImageButtonData[]>([]);

  // --- Text buttons ---
  const addTextButton = useCallback((x: number, y: number) => {
    const btn: CanvasTextButtonData = {
      id: crypto.randomUUID(),
      x,
      y,
      text: '',
      href: '',
      color: '#292524',
      fontSize: 28,
      bold: false,
      rotation: 0,
      isEditing: true,
    };
    setTextButtons((prev) => [...prev, btn]);
    return btn.id;
  }, []);

  const updateTextButton = useCallback((id: string, updates: Partial<CanvasTextButtonData>) => {
    setTextButtons((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  }, []);

  const lockTextButton = useCallback((id: string) => {
    setTextButtons((prev) =>
      prev
        .map((b) => {
          if (b.id === id) {
            if (!b.text.trim()) return b;
            return { ...b, isEditing: false };
          }
          return b;
        })
        .filter((b) => b.text.trim() || b.isEditing)
    );
  }, []);

  const deleteTextButton = useCallback((id: string) => {
    setTextButtons((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // --- Image buttons ---
  const addImageButton = useCallback(
    (src: string, naturalWidth: number, naturalHeight: number, href: string, x: number, y: number) => {
      const displayWidth = 200;
      const displayHeight = (naturalHeight / naturalWidth) * displayWidth;
      const btn: CanvasImageButtonData = {
        id: crypto.randomUUID(),
        x: x - displayWidth / 2,
        y: y - displayHeight / 2,
        width: displayWidth,
        height: displayHeight,
        src,
        href,
        naturalWidth,
        naturalHeight,
        isEditing: true,
      };
      setImageButtons((prev) => [...prev, btn]);
      return btn.id;
    },
    []
  );

  const updateImageButton = useCallback((id: string, updates: Partial<CanvasImageButtonData>) => {
    setImageButtons((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  }, []);

  const lockImageButton = useCallback((id: string) => {
    setImageButtons((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isEditing: false } : b))
    );
  }, []);

  const deleteImageButton = useCallback((id: string) => {
    setImageButtons((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return {
    textButtons,
    setTextButtons,
    addTextButton,
    updateTextButton,
    lockTextButton,
    deleteTextButton,
    imageButtons,
    setImageButtons,
    addImageButton,
    updateImageButton,
    lockImageButton,
    deleteImageButton,
  };
}
