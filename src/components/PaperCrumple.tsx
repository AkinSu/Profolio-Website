"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface PaperCrumpleProps {
  onComplete: () => void;
}

export function PaperCrumple({ onComplete }: PaperCrumpleProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [written, setWritten] = useState(false);
  const [crumpling, setCrumpling] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [done, setDone] = useState(false);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Size canvas to viewport (object-fit: cover simulation)
    const cw = canvas.width;
    const ch = canvas.height;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Crop source to simulate object-fit: cover
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const videoAspect = vw / vh;
    const canvasAspect = cw / ch;
    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (videoAspect > canvasAspect) {
      sw = vh * canvasAspect;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / canvasAspect;
      sy = (vh - sh) / 2;
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);

    // Chroma key: green → transparent
    const frame = ctx.getImageData(0, 0, cw, ch);
    const data = frame.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (g > 90 && g > r * 1.3 && g > b * 1.3) {
        data[i + 3] = 0;
      }
    }
    ctx.putImageData(frame, 0, 0);

    // Signal first frame is ready
    setCanvasReady(true);

    // Continue loop while playing; draw one final frame after ended
    if (!video.ended) {
      animationRef.current = requestAnimationFrame(processFrame);
    }
  }, []);

  // Set canvas to viewport size and update on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setSize();
    window.addEventListener("resize", setSize);
    return () => window.removeEventListener("resize", setSize);
  }, []);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setWritten(true), 1800);

    const video = videoRef.current;
    if (video) {
      const handlePlay = () => processFrame();
      const handleLoadedData = () => processFrame();
      video.addEventListener("play", handlePlay);
      video.addEventListener("loadeddata", handleLoadedData);
      return () => {
        clearTimeout(timer);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("loadeddata", handleLoadedData);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
    }

    return () => clearTimeout(timer);
  }, [processFrame]);

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
      {/* ── Notebook paper background — always visible until overlay unmounts ── */}
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

      {/* ── SVG handwriting animation ── */}
      {!crumpling && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
          <svg viewBox="0 0 200 80" style={{ width: "clamp(200px, 30vw, 400px)", overflow: "visible" }}>
            <text
              x="50%" y="55" textAnchor="middle"
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: "60px",
                fill: "none",
                stroke: "#1a1a2e",
                strokeWidth: 0.6,
                strokeDasharray: 300,
                strokeDashoffset: 300,
                animation: "write 1.5s ease forwards 0.3s",
              }}
            >
              akin
            </text>
            <text
              x="50%" y="55" textAnchor="middle"
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: "60px",
                fill: "#1a1a2e",
                stroke: "none",
                opacity: 0,
                animation: "fadeIn 0.4s ease forwards 1.6s",
              }}
            >
              akin
            </text>
          </svg>
        </div>
      )}

      {/* ── Click hint ── */}
      {written && !crumpling && (
        <div
          style={{
            position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
            color: "rgba(100,100,100,0.5)", fontSize: 13,
            fontFamily: "'Caveat', cursive", letterSpacing: "0.05em",
            zIndex: 3, animation: "fadeIn 0.5s ease forwards",
          }}
        >
          click anywhere
        </div>
      )}

      {/* ── Hidden video source ── */}
      <video
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        onEnded={handleVideoEnd}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", zIndex: -1 }}
      >
        <source src="/crumple.webm" type="video/webm" />
        <source src="/crumple.mp4" type="video/mp4" />
      </video>

      {/* ── Canvas with chroma key — appears only after first frame is ready ── */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute", inset: 0,
          zIndex: 1,
          opacity: crumpling && canvasReady ? 1 : 0,
          pointerEvents: "none",
        }}
      />

      <style>{`
        @keyframes write { to { stroke-dashoffset: 0; } }
        @keyframes fadeIn { to { opacity: 1; } }
      `}</style>
    </div>
  );
}
