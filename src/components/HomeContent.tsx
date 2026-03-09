"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { motion, useMotionValue } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { IntroAnimation } from "@/components/IntroAnimation";
import { DevButton, CanvasMode } from "@/components/DevButton";
import { StickyNote } from "@/components/StickyNote";
import { useStickyNotes } from "@/hooks/useStickyNotes";
import { CanvasText } from "@/components/CanvasText";
import { useCanvasTexts } from "@/hooks/useCanvasTexts";
import { CanvasImage } from "@/components/CanvasImage";
import { useCanvasImages } from "@/hooks/useCanvasImages";

export default function HomeContent() {
  const [overlayDone, setOverlayDone] = useState(false);
  const [mode, setMode] = useState<CanvasMode>('pan');
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  const [activeCursor, setActiveCursor] = useState<string | null>(null);
  const pencilActiveRef = useRef(false);

  const { notes, addNote, updateNote, lockNote, deleteNote } = useStickyNotes();
  const { texts, addText, updateText, lockText, deleteText } = useCanvasTexts();
  const { images, addImage, updateImage, deleteImage } = useCanvasImages();

  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);

  const isPanningRef = useRef(false);
  const didPanRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const outerRef = useRef<HTMLDivElement>(null);
  const rulesRef = useRef<HTMLDivElement>(null);
  const [panLimitPos, setPanLimitPos] = useState<{ x: number; y: number } | null>(null);


  // Disable cartoon cursors when dev menu open or in dev modes
  const disableCursors = devMenuOpen || mode === 'place' || mode === 'text';

  const handleCursorChange = useCallback((cursor: string | null) => {
    pencilActiveRef.current = cursor === "pencil";
    setActiveCursor(cursor);
  }, []);

  const handleImageUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Place image at center of current viewport in canvas coords
      const cx = -offsetX.get() + window.innerWidth / 2;
      const cy = -offsetY.get() + window.innerHeight / 2;
      addImage(url, img.naturalWidth, img.naturalHeight, cx, cy);
    };
    img.src = url;
  }, [addImage, offsetX, offsetY]);

  const getCursor = useCallback(() => {
    if (mode === 'place' || mode === 'text') return 'crosshair';
    return 'grab';
  }, [mode]);

  useEffect(() => {
    const stop = () => {
      isPanningRef.current = false;
      if (outerRef.current) outerRef.current.style.cursor = getCursor();
    };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, [getCursor]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, textarea")) return;
    if (mode === 'place' || mode === 'text') return;
    if (pencilActiveRef.current) return;
    e.preventDefault(); // prevent text selection while dragging
    isPanningRef.current = true;
    didPanRef.current = false;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    if (outerRef.current) outerRef.current.style.cursor = "grabbing";
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didPanRef.current = true;

    const rawX = offsetX.get() + dx;
    const rawY = offsetY.get() + dy;
    const clampedX = Math.min(0, rawX);
    const clampedY = Math.min(2000, Math.max(window.innerHeight - 3000, rawY));
    offsetX.set(clampedX);
    offsetY.set(clampedY);

    if (rawX !== clampedX || rawY !== clampedY) {
      setPanLimitPos({ x: e.clientX, y: e.clientY });
    } else {
      setPanLimitPos(null);
    }

    if (rulesRef.current) {
      rulesRef.current.style.backgroundPosition = `0 ${48 + offsetY.get()}px`;
    }
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
    setPanLimitPos(null);
    if (outerRef.current) outerRef.current.style.cursor = getCursor();
  };

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, textarea")) return;
    if (mode === 'place') {
      // Don't create another note if one is still being edited
      if (notes.some((n) => n.isEditing)) return;
      const x = e.clientX - offsetX.get() - 160;
      const y = e.clientY - offsetY.get() - 20;
      addNote(x, y);
    } else if (mode === 'text') {
      // Don't create another text if one is still being edited
      if (texts.some((t) => t.isEditing)) return;
      const x = e.clientX - offsetX.get();
      const y = e.clientY - offsetY.get();
      addText(x, y);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode('pan');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <>
      <IntroAnimation onComplete={() => setOverlayDone(true)} />

      <div
        ref={outerRef}
        style={{
          height: "100vh",
          position: "relative",
          overflow: "hidden",
          userSelect: "none",
          cursor: getCursor(),
          backgroundColor: "#f5f5f0",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
      >

        {/* Pan limit indicator */}
        {panLimitPos && (
          <div
            style={{
              position: 'fixed',
              left: panLimitPos.x + 20,
              top: panLimitPos.y - 24,
              zIndex: 99999,
              pointerEvents: 'none',
              userSelect: 'none',
              fontSize: 22,
              fontWeight: 900,
              color: '#dc2626',
              textShadow: '0 1px 4px rgba(0,0,0,0.15)',
              fontFamily: 'sans-serif',
              lineHeight: 1,
            }}
          >
            !
          </div>
        )}

        <Navigation
          onCursorChange={handleCursorChange}
          disableCursors={disableCursors}
        />
        <DevButton mode={mode} onModeChange={setMode} onOpenChange={setDevMenuOpen} onImageUpload={handleImageUpload} />

        {/* Layer 1: Blue ruled lines */}
        <div
          ref={rulesRef}
          style={{
            position: "absolute",
            top: -3000,
            bottom: -3000,
            left: 0,
            right: 0,
            pointerEvents: "none",
            backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, rgba(140,180,220,0.25) 31px, rgba(140,180,220,0.25) 32px)",
            backgroundSize: "100% 32px",
            backgroundPosition: "0 48px",
            zIndex: 0,
          }}
        />

        {/* Layer 2+3: Pan layer */}
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            x: offsetX,
            y: offsetY,
          }}
        >
          {/* Red margin line */}
          <div
            style={{
              position: "absolute",
              top: -2000,
              left: "11.5vw",
              width: "0.5vw",
              height: 5000,
              backgroundColor: "rgba(220,80,80,0.3)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />

          {/* Top margin */}
          <div
            style={{
              position: "absolute",
              top: -2000,
              left: 0,
              width: 99999,
              height: 224,
              backgroundColor: "#f5f5f0",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />

          {/* Canvas images */}
          {images.map((img) => (
            <CanvasImage
              key={img.id}
              data={img}
              onUpdate={updateImage}
              onDelete={deleteImage}
              disabled={!!activeCursor}
            />
          ))}

          {/* Canvas texts */}
          <div style={{ color: '#292524' }}>
            {texts.map((t) => (
              <CanvasText
                key={t.id}
                data={t}
                onUpdate={updateText}
                onLock={lockText}
                onDelete={deleteText}
                disabled={!!activeCursor}
              />
            ))}
          </div>

          {/* Sticky notes — block most interaction when hand/pencil active, but hand can still tilt */}
          <div style={{ color: '#292524' }}>
            {notes.map((note) => (
              <StickyNote
                key={note.id}
                note={note}
                onUpdate={updateNote}
                onLock={lockNote}
                onDelete={deleteNote}
                cursorMode={activeCursor}
                devMode={devMenuOpen}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </>
  );
}
