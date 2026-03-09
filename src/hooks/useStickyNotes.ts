import { useState, useCallback } from 'react';

export type MediaType = 'image' | 'video' | 'gif' | null;

export interface StickyNoteData {
  id: string;
  x: number;
  y: number;
  width: number;
  color: string;
  topText: string;
  topBold: boolean;
  topItalic: boolean;
  topCenter: boolean;
  bottomText: string;
  bottomBold: boolean;
  bottomItalic: boolean;
  bottomCenter: boolean;
  imageUrl: string | null;
  mediaType: MediaType;
  isEditing: boolean;
}

const COLORS = [
'#FFF176',
'#F48FB1',
'#90CAF9',
'#A5D6A7',
'#FFCC80',
'#CE93D8'];


function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export function useStickyNotes() {
  const [notes, setNotes] = useState<StickyNoteData[]>([]);

  const addNote = useCallback((x: number, y: number) => {
    const note: StickyNoteData = {
      id: crypto.randomUUID(),
      x,
      y,
      width: 320,
      color: randomColor(),
      topText: '',
      topBold: false,
      topItalic: false,
      topCenter: false,
      bottomText: '',
      bottomBold: false,
      bottomItalic: false,
      bottomCenter: false,
      imageUrl: null,
      mediaType: null,
      isEditing: true
    };
    setNotes((prev) => [...prev, note]);
    return note.id;
  }, []);

  const updateNote = useCallback(
    (id: string, updates: Partial<StickyNoteData>) => {
      setNotes((prev) =>
      prev.map((n) => n.id === id ? { ...n, ...updates } : n)
      );
    },
    []
  );

  const lockNote = useCallback((id: string) => {
    setNotes((prev) =>
    prev.map((n) => n.id === id ? { ...n, isEditing: false } : n)
    );
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notes, addNote, updateNote, lockNote, deleteNote };
}
