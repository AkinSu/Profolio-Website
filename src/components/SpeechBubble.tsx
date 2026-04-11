"use client";

import { useEffect, useRef, useState } from "react";

interface SpeechBubbleProps {
  text: string;
  eyeCanvasX: number;
  eyeCanvasY: number;
  eyeWidth: number;
  eyeHeight: number;
  loading?: boolean;
  onClick?: () => void;
}

// ─── Layout ───
const FONT_SIZE = 17;
const LINE_HEIGHT = 23;
const TEXT_PAD = 14;
const MAX_CHARS = 20;
const TYPEWRITER_MS = 38;
const PAD = 8; // canvas element padding beyond bubble edges
const CORNER_R = 10;
const STAMP_SPACING = 2;
const TIP_SIZE = 14;

// ─── Graphite engine (mirrors DrawingElement) ───

function paperGrain(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

let tipCache: HTMLCanvasElement | null = null;
function getGraphiteTip(): HTMLCanvasElement {
  if (tipCache) return tipCache;
  const c = document.createElement("canvas");
  c.width = c.height = TIP_SIZE;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(TIP_SIZE, TIP_SIZE);
  const center = TIP_SIZE / 2;
  const radius = TIP_SIZE / 2;
  for (let y = 0; y < TIP_SIZE; y++) {
    for (let x = 0; x < TIP_SIZE; x++) {
      const dx = x - center, dy = y - center;
      const dist = Math.sqrt(dx * dx * 1.0 + dy * dy * 1.5);
      const edgeNoise = 0.85 + paperGrain(x * 3.7, y * 3.7) * 0.3;
      const effectiveRadius = radius * edgeNoise;
      const idx = (y * TIP_SIZE + x) * 4;
      if (dist < effectiveRadius) {
        let alpha = 1.0 - dist / effectiveRadius;
        alpha = Math.pow(alpha, 2.5) * (0.6 + Math.random() * 0.4);
        img.data[idx] = 50; img.data[idx + 1] = 50;
        img.data[idx + 2] = 55; img.data[idx + 3] = Math.floor(alpha * 240);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  tipCache = c;
  return tipCache;
}

interface Pt { x: number; y: number; pressure: number; }

function stampPoint(ctx: CanvasRenderingContext2D, tip: HTMLCanvasElement, pt: Pt) {
  const grain = paperGrain(pt.x * 0.5, pt.y * 0.5);
  const grainMultiplier = (0.4 + pt.pressure * 0.35) + grain * (0.6 - pt.pressure * 0.35);
  const baseScale = 0.7 + pt.pressure * 0.35;
  const alpha = (0.20 + pt.pressure * 0.60) * (0.9 + Math.random() * 0.1) * grainMultiplier;
  const rotation = (Math.random() - 0.5) * 0.5;
  const sx = (Math.random() - 0.5) * 0.8, sy = (Math.random() - 0.5) * 0.8;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(pt.x + sx, pt.y + sy);
  ctx.rotate(rotation);
  ctx.drawImage(tip,
    -(TIP_SIZE * baseScale) / 2, -(TIP_SIZE * baseScale) / 2,
    TIP_SIZE * baseScale, TIP_SIZE * baseScale);
  ctx.restore();
}

function interpolateStamps(a: Pt, b: Pt): Pt[] {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist / STAMP_SPACING);
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    pts.push({ x: a.x + dx * t, y: a.y + dy * t, pressure: a.pressure + (b.pressure - a.pressure) * t });
  }
  return pts;
}

// ─── Bubble shape geometry ───

function wrapText(text: string): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > MAX_CHARS) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

/**
 * Generate point arrays that trace the bubble perimeter.
 * All coordinates are in canvas-element local space (0,0 = canvas top-left).
 */
function generateBubblePoints(
  lbx: number, lby: number, lbw: number, lbh: number,
  ltx: number, lty: number
): Pt[] {
  const pts: Pt[] = [];
  const r = CORNER_R;

  // Straight edge: pressure varies like sin(t*π) for heavier middle
  function line(x1: number, y1: number, x2: number, y2: number, basePressure = 0.62) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(2, Math.ceil(dist / 5));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = basePressure + Math.sin(t * Math.PI) * 0.10;
      // Perpendicular wobble: deterministic grain + small random flutter
      const grain = (paperGrain(x1 + dx * t + 7, y1 + dy * t + 3) - 0.5) * 2.5;
      const flutter = (Math.random() - 0.5) * 0.8;
      const wobble = grain + flutter;
      const len = dist || 1;
      const px = -dy / len * wobble, py = dx / len * wobble;
      pts.push({ x: x1 + dx * t + px, y: y1 + dy * t + py, pressure: p });
    }
  }

  // Corner arc: lighter pressure, jittered center so no two corners look identical
  function arc(cx: number, cy: number, a0: number, a1: number) {
    const jx = (Math.random() - 0.5) * 2.5;
    const jy = (Math.random() - 0.5) * 2.5;
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * i / steps;
      const rj = r + (Math.random() - 0.5) * 2;
      pts.push({ x: cx + jx + rj * Math.cos(a), y: cy + jy + rj * Math.sin(a), pressure: 0.50 });
    }
  }

  // Trace clockwise starting from top-left
  arc(lbx + r, lby + r, Math.PI, Math.PI * 1.5);          // top-left corner
  line(lbx + r, lby, lbx + lbw - r, lby);                   // top edge
  arc(lbx + lbw - r, lby + r, Math.PI * 1.5, 2 * Math.PI); // top-right corner
  line(lbx + lbw, lby + r, lbx + lbw, lby + lbh - r);       // right edge
  arc(lbx + lbw - r, lby + lbh - r, 0, Math.PI * 0.5);     // bottom-right corner
  line(lbx + lbw - r, lby + lbh, ltx + 9, lby + lbh);       // bottom → tail right
  line(ltx + 9, lby + lbh, ltx, lty, 0.52);                  // tail right stroke
  line(ltx, lty, ltx - 9, lby + lbh, 0.52);                  // tail left stroke
  line(ltx - 9, lby + lbh, lbx + r, lby + lbh);              // tail left → bottom-left
  arc(lbx + r, lby + lbh - r, Math.PI * 0.5, Math.PI);      // bottom-left corner
  line(lbx, lby + lbh - r, lbx, lby + r);                    // left edge

  return pts;
}

// ─── Component ───

export function SpeechBubble({
  text, eyeCanvasX, eyeCanvasY, eyeWidth, eyeHeight, loading = false, onClick,
}: SpeechBubbleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [displayText, setDisplayText] = useState("");
  const typeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shownText = loading ? "..." : text;
  const lines = wrapText(shownText);
  const bubbleW = MAX_CHARS * (FONT_SIZE * 0.62) + TEXT_PAD * 2;
  const bubbleH = lines.length * LINE_HEIGHT + TEXT_PAD * 2 + 6;

  // Canvas-space positioning
  const bx = eyeCanvasX - eyeWidth / 2 - 12;
  const by = eyeCanvasY - eyeHeight / 2 - bubbleH - 20;
  const tailX = eyeCanvasX;
  const tailY = eyeCanvasY - eyeHeight / 2 - 5;

  const tailDrop = tailY - (by + bubbleH); // ~15px
  const canvasW = bubbleW + PAD * 2;
  const canvasH = bubbleH + tailDrop + PAD * 2;

  // Local coords within canvas element
  const lbx = PAD, lby = PAD;
  const lbw = bubbleW, lbh = bubbleH;
  const ltx = PAD + (tailX - bx);
  const lty = PAD + (tailY - by);

  // Draw fill + graphite outline onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasW, canvasH);

    // Graphite outline only — no fill, paper shows through
    const tip = getGraphiteTip();
    const pts = generateBubblePoints(lbx, lby, lbw, lbh, ltx, lty);
    for (let i = 1; i < pts.length; i++) {
      const stamps = interpolateStamps(pts[i - 1], pts[i]);
      for (const pt of stamps) stampPoint(ctx, tip, pt);
    }
  }, [canvasW, canvasH, lbx, lby, lbw, lbh, ltx, lty]);

  // Typewriter
  useEffect(() => {
    setDisplayText("");
    if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
    if (loading) { setDisplayText("..."); return; }
    let i = 0;
    const type = () => {
      i++;
      setDisplayText(text.slice(0, i));
      if (i < text.length) typeTimerRef.current = setTimeout(type, TYPEWRITER_MS);
    };
    typeTimerRef.current = setTimeout(type, TYPEWRITER_MS);
    return () => { if (typeTimerRef.current) clearTimeout(typeTimerRef.current); };
  }, [text, loading]);

  return (
    <>
      {/* Canvas: fill + pencil-drawn outline, positioned in canvas space */}
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        style={{
          position: "absolute",
          left: bx - PAD,
          top: by - PAD,
          width: canvasW,
          height: canvasH,
          pointerEvents: "none",
          zIndex: 11,
        }}
      />
      {/* Text — HTML div guarantees PaperHand font renders */}
      <div
        onClick={onClick}
        style={{
          position: "absolute",
          left: bx + TEXT_PAD,
          top: by + TEXT_PAD,
          width: bubbleW - TEXT_PAD * 2,
          fontFamily: "'PaperHand', cursive",
          fontSize: FONT_SIZE,
          color: "#2d2926",
          lineHeight: `${LINE_HEIGHT}px`,
          pointerEvents: onClick ? "all" : "none",
          cursor: onClick ? "pointer" : "default",
          userSelect: "none",
          zIndex: 12,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {displayText}
      </div>
    </>
  );
}
