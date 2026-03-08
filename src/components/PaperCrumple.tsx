"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface PaperCrumpleProps {
  onComplete: () => void;
}

export function PaperCrumple({ onComplete }: PaperCrumpleProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [written, setWritten] = useState(false);
  const [crumpling, setCrumpling] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => setWritten(true), 1800);
    return () => clearTimeout(t);
  }, []);

  const handleClick = useCallback(() => {
    if (crumpling || !written) return;
    setCrumpling(true);
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {
        setTimeout(() => { setDone(true); onComplete(); }, 500);
      });
    }
  }, [crumpling, written, onComplete]);

  const handleVideoEnd = useCallback(() => {
    setTimeout(() => { setDone(true); onComplete(); }, 100);
  }, [onComplete]);

  if (!mounted) {
    return <div style={{ position: "fixed", inset: 0, backgroundColor: "#f5f5f0", zIndex: 9999 }} />;
  }

  if (done) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, cursor: written && !crumpling ? "pointer" : "default" }}
      onClick={handleClick}
    >
      {/* Paper background — visible until crumple starts */}
      {!crumpling && (
        <div
          style={{
            position: "absolute", inset: 0,
            backgroundColor: "#f5f5f0",
            backgroundImage: `
              repeating-linear-gradient(transparent, transparent 31px, rgba(140,180,220,0.25) 31px, rgba(140,180,220,0.25) 32px),
              linear-gradient(90deg, transparent 11.5%, rgba(220,80,80,0.3) 11.5%, rgba(220,80,80,0.3) 12%, transparent 12%)
            `,
            backgroundSize: "100% 32px, 100% 100%",
            backgroundPosition: "0 48px, 0 0",
          }}
        />
      )}

      {/* SVG handwriting animation */}
      {!crumpling && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
          <svg viewBox="0 0 200 80" style={{ width: "clamp(200px, 30vw, 400px)", overflow: "visible" }}>
            <text x="50%" y="55" textAnchor="middle" style={{
              fontFamily: "'Caveat', cursive", fontSize: "60px",
              fill: "none", stroke: "#1a1a2e", strokeWidth: 0.6,
              strokeDasharray: 300, strokeDashoffset: 300,
              animation: "write 1.5s ease forwards 0.3s",
            }}>akin</text>
            <text x="50%" y="55" textAnchor="middle" style={{
              fontFamily: "'Caveat', cursive", fontSize: "60px",
              fill: "#1a1a2e", stroke: "none", opacity: 0,
              animation: "fadeIn 0.4s ease forwards 1.6s",
            }}>akin</text>
          </svg>
        </div>
      )}

      {/* Click hint */}
      {written && !crumpling && (
        <div style={{
          position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
          color: "rgba(100,100,100,0.5)", fontSize: 13,
          fontFamily: "'Caveat', cursive", letterSpacing: "0.05em",
          zIndex: 3, animation: "fadeIn 0.5s ease forwards",
        }}>
          click anywhere
        </div>
      )}

      {/* Fullscreen video — hardware decoded, no canvas */}
      <video
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        onEnded={handleVideoEnd}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          zIndex: 1,
          opacity: crumpling ? 1 : 0,
        }}
      >
        <source src="/crumple.webm" type="video/webm" />
        <source src="/crumple.mp4" type="video/mp4" />
      </video>

      <style>{`
        @keyframes write { to { stroke-dashoffset: 0; } }
        @keyframes fadeIn { to { opacity: 1; } }
      `}</style>
    </div>
  );
}
