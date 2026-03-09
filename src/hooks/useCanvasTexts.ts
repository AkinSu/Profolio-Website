import { useState, useCallback } from 'react';

export interface CanvasTextData {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  bold: boolean;
  rotation: number;
  isEditing: boolean;
}

export const TEXT_COLORS = ['#292524', '#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#ca8a04'];

export function useCanvasTexts() {
  const [texts, setTexts] = useState<CanvasTextData[]>([]);

  const addText = useCallback((x: number, y: number) => {
    const t: CanvasTextData = {
      id: crypto.randomUUID(),
      x,
      y,
      text: '',
      color: '#292524',
      fontSize: 28,
      bold: false,
      rotation: 0,
      isEditing: true,
    };
    setTexts((prev) => [...prev, t]);
    return t.id;
  }, []);

  const updateText = useCallback((id: string, updates: Partial<CanvasTextData>) => {
    setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const lockText = useCallback((id: string) => {
    setTexts((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          // If empty text, remove it instead of locking
          if (!t.text.trim()) return t;
          return { ...t, isEditing: false };
        }
        return t;
      }).filter((t) => t.text.trim() || t.isEditing)
    );
  }, []);

  const deleteText = useCallback((id: string) => {
    setTexts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { texts, addText, updateText, lockText, deleteText };
}
