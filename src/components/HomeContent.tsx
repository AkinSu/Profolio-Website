"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useMotionValue } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { IntroAnimation } from "@/components/IntroAnimation";

export default function HomeContent() {
  const [overlayDone, setOverlayDone] = useState(false);

  // MotionValues update the DOM transform directly — zero React re-renders while panning
  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);

  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const outerRef = useRef<HTMLDivElement>(null);
  const rulesRef = useRef<HTMLDivElement>(null);

  // Stop pan if mouse leaves window
  useEffect(() => {
    const stop = () => {
      isPanningRef.current = false;
      if (outerRef.current) outerRef.current.style.cursor = "grab";
    };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    isPanningRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    if (outerRef.current) outerRef.current.style.cursor = "grabbing";
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    // Left boundary: can't pan right past the margin
    // Top boundary: can't pan past the top edge of the paper (matches top: -2000 on red line)
    // Bottom boundary: can't pan past the bottom of the red line (top:-2000 + height:5000 = y:3000)
    offsetX.set(Math.min(0, offsetX.get() + dx));
    offsetY.set(Math.min(2000, Math.max(window.innerHeight - 3000, offsetY.get() + dy)));

    // Blue rules background updates via DOM ref — no re-render needed
    if (rulesRef.current) {
      rulesRef.current.style.backgroundPosition = `0 ${48 + offsetY.get()}px`;
    }
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
    if (outerRef.current) outerRef.current.style.cursor = "grab";
  };

  return (
    <>
      <IntroAnimation onComplete={() => setOverlayDone(true)} />

      {/* Plain div — no Chakra, no potential CSS containment surprises */}
      <div
        ref={outerRef}
        style={{
          height: "100vh",
          position: "relative",
          overflow: "hidden",
          userSelect: "none",
          cursor: "grab",
          backgroundColor: "#f5f5f0",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <Navigation />

        {/* Layer 1: Blue ruled lines — shifts Y only, updated via DOM ref */}
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

        {/* Layer 2+3: Pan layer — shifts X and Y together via MotionValues */}
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

          {/* Top margin — blank paper area above the first ruled line (7 lines = 224px) */}
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

        </motion.div>
      </div>
    </>
  );
}
