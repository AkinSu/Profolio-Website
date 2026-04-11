"use client";

import { useEffect, useRef } from "react";

interface Props {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function paperGrain(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function sketchLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number
) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(4, Math.ceil(dist / 10));

  ctx.beginPath();
  ctx.moveTo(x1 + (Math.random() - 0.5) * 2, y1 + (Math.random() - 0.5) * 2);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const grain = paperGrain(x1 + dx * t, y1 + dy * t) * 2 - 1;
    ctx.lineTo(
      x1 + dx * t + grain * 2.5,
      y1 + dy * t + grain * 2.5
    );
  }
  ctx.lineWidth = 1.0 + Math.random() * 0.8;
  ctx.strokeStyle = `rgba(55, 50, 45, ${0.22 + Math.random() * 0.12})`;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

export function PersistZoneBorder({ x1, y1, x2, y2 }: Props) {
  const PAD = 16;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const w = x2 - x1 + PAD * 2;
  const h = y2 - y1 + PAD * 2;

  // Offset all drawing coords by PAD so jitter doesn't get clipped
  const L = PAD, T = PAD, R = w - PAD, B = h - PAD;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    // Draw each side twice with slightly different jitter for a sketched look
    for (let pass = 0; pass < 2; pass++) {
      sketchLine(ctx, L, T, R, T); // top
      sketchLine(ctx, R, T, R, B); // right
      sketchLine(ctx, R, B, L, B); // bottom
      sketchLine(ctx, L, B, L, T); // left
    }

    // Faint label
    ctx.font = "italic 22px 'PaperHand', cursive";
    ctx.fillStyle = "rgba(55,50,45,0.28)";
    ctx.fillText("leave a mark ↓", L + 12, T - 8);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={w}
      height={h}
      style={{
        position: "absolute",
        left: x1 - PAD,
        top: y1 - PAD,
        width: w,
        height: h,
        pointerEvents: "none",
        zIndex: 2,
      }}
    />
  );
}
