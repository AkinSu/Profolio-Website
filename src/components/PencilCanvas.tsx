"use client";

import { useRef, useEffect, useCallback } from "react";
import { MotionValue } from "framer-motion";

// ─── Types ───

interface Point {
  x: number;
  y: number;
  pressure: number;
  tiltX?: number;
  tiltY?: number;
}

export interface PencilStroke {
  points: Point[];
}

interface PencilCanvasProps {
  offsetX: MotionValue<number>;
  offsetY: MotionValue<number>;
  isActive: boolean;
  isAdmin: boolean;
  devDrawMode?: boolean; // dev toggle — draw anywhere
  strokes?: PencilStroke[];
  onStrokeComplete?: (stroke: PencilStroke) => void;
}

// ─── Constants ───

const CANVAS_W = 8000;
const CANVAS_H = 6000; // Covers full pannable Y range (-2000 to 4000)
const CANVAS_Y_OFFSET = -2000; // Canvas starts 2000px above world origin
const TIP_SIZE = 14;
const STAMP_SPACING = 2;

// ─── Paper grain noise (deterministic hash from position) ───

function paperGrain(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

// ─── Brush tip generator (oval with edge irregularity) ───

function createGraphiteTip(size = TIP_SIZE): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const center = size / 2;
  const radius = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      // Oval shape — slightly taller than wide (pencil contact patch)
      const dist = Math.sqrt(dx * dx * 1.0 + dy * dy * 1.5);
      // Edge irregularity
      const edgeNoise = 0.85 + paperGrain(x * 3.7, y * 3.7) * 0.3;
      const effectiveRadius = radius * edgeNoise;
      const i = (y * size + x) * 4;
      if (dist < effectiveRadius) {
        let alpha = 1.0 - dist / effectiveRadius;
        alpha = Math.pow(alpha, 2.5);
        alpha *= 0.6 + Math.random() * 0.4;
        img.data[i] = 50;
        img.data[i + 1] = 50;
        img.data[i + 2] = 55;
        img.data[i + 3] = Math.floor(alpha * 240);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ─── Stamp interpolation ───

function getStampPoints(prev: Point, curr: Point, spacing = STAMP_SPACING): Point[] {
  const dx = curr.x - prev.x;
  const dy = curr.y - prev.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist / spacing);
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    points.push({
      x: prev.x + dx * t,
      y: prev.y + dy * t,
      pressure: prev.pressure + (curr.pressure - prev.pressure) * t,
      tiltX: prev.tiltX !== undefined && curr.tiltX !== undefined
        ? prev.tiltX + (curr.tiltX - prev.tiltX) * t : prev.tiltX,
      tiltY: prev.tiltY !== undefined && curr.tiltY !== undefined
        ? prev.tiltY + (curr.tiltY - prev.tiltY) * t : prev.tiltY,
    });
  }
  return points;
}

// ─── Speed-based pressure for mouse ───

function pressureFromSpeed(dx: number, dy: number, dt: number): number {
  if (dt <= 0) return 0.45;
  const speed = Math.sqrt(dx * dx + dy * dy) / dt;
  return Math.max(0.1, Math.min(0.8, 0.8 - speed * 0.5));
}

// ─── Component ───

export function PencilCanvas({
  offsetX,
  offsetY,
  isActive,
  isAdmin,
  devDrawMode,
  strokes,
  onStrokeComplete,
}: PencilCanvasProps) {
  const committedRef = useRef<HTMLCanvasElement | null>(null);
  const tempRef = useRef<HTMLCanvasElement | null>(null);
  const displayRef = useRef<HTMLCanvasElement | null>(null);
  const tipRef = useRef<HTMLCanvasElement | null>(null);

  const isDrawing = useRef(false);
  const currentPoints = useRef<Point[]>([]);
  const lastPoint = useRef<Point | null>(null);
  const lastTime = useRef(0);
  const rafId = useRef<number | null>(null);
  const needsRender = useRef(false);
  const renderedStrokesCount = useRef(0);

  // ─── Initialize brush tip ───
  useEffect(() => {
    tipRef.current = createGraphiteTip(TIP_SIZE);
  }, []);

  // ─── Stamp a single point onto a context ───
  const stamp = useCallback(
    (ctx: CanvasRenderingContext2D, pt: Point) => {
      if (!tipRef.current) return;

      // Paper grain modulates opacity — no gaps, just texture variation
      const grain = paperGrain(pt.x * 0.5, pt.y * 0.5);
      const grainFloor = 0.4 + pt.pressure * 0.35;
      const grainMultiplier = grainFloor + grain * (1.0 - grainFloor);

      // Tilt (stylus only)
      const tiltX = pt.tiltX || 0;
      const tiltY = pt.tiltY || 0;
      const tiltMag = Math.sqrt(tiltX * tiltX + tiltY * tiltY);
      const tiltNorm = Math.min(tiltMag / 60, 1);
      const tiltAngle = Math.atan2(tiltY, tiltX);

      // Size: pressure affects thickness subtly, tilt elongates
      const baseScale = 0.7 + pt.pressure * 0.35;
      const scaleX = baseScale * (1 + tiltNorm * 2.0);
      const scaleY = baseScale * (1 - tiltNorm * 0.3);

      // Opacity: pressure affects darkness heavily + jitter + grain + tilt
      const baseAlpha = 0.20 + pt.pressure * 0.60;
      const jitter = 0.9 + Math.random() * 0.1;
      const alpha = baseAlpha * jitter * grainMultiplier * (1 - tiltNorm * 0.4);

      // Scatter — subtle edge irregularity
      const scatterX = (Math.random() - 0.5) * 0.8;
      const scatterY = (Math.random() - 0.5) * 0.8;

      // Rotation jitter + tilt direction
      const rotation = (Math.random() - 0.5) * 0.5 + tiltAngle * tiltNorm;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(pt.x + scatterX, pt.y + scatterY);
      ctx.rotate(rotation);
      ctx.scale(scaleX / baseScale, scaleY / baseScale); // apply tilt elongation
      ctx.drawImage(
        tipRef.current,
        -(TIP_SIZE * baseScale) / 2,
        -(TIP_SIZE * baseScale) / 2,
        TIP_SIZE * baseScale,
        TIP_SIZE * baseScale
      );
      ctx.restore();
    },
    []
  );

  // ─── Render a full stroke onto a context (for replaying saved strokes) ───
  const renderStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: PencilStroke) => {
      if (stroke.points.length < 2) return;
      for (let i = 1; i < stroke.points.length; i++) {
        const stamps = getStampPoints(stroke.points[i - 1], stroke.points[i]);
        for (const pt of stamps) {
          stamp(ctx, pt);
        }
      }
    },
    [stamp]
  );

  // ─── Render saved strokes from props onto committed canvas ───
  useEffect(() => {
    if (!strokes || strokes.length === 0) return;
    const committed = committedRef.current;
    if (!committed) return;
    const ctx = committed.getContext("2d");
    if (!ctx) return;

    const startIdx = renderedStrokesCount.current;
    if (startIdx >= strokes.length) return;

    const tempStroke = document.createElement("canvas");
    tempStroke.width = CANVAS_W;
    tempStroke.height = CANVAS_H;
    const tempCtx = tempStroke.getContext("2d")!;

    for (let i = startIdx; i < strokes.length; i++) {
      tempCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      renderStroke(tempCtx, strokes[i]);
      ctx.globalAlpha = 1.0;
      ctx.drawImage(tempStroke, 0, 0);
      ctx.globalAlpha = 1.0;
    }

    renderedStrokesCount.current = strokes.length;

    const display = displayRef.current;
    if (display) {
      const dCtx = display.getContext("2d");
      if (dCtx) {
        dCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        dCtx.drawImage(committed, 0, 0);
      }
    }
  }, [strokes, renderStroke]);

  // ─── Render loop ───
  useEffect(() => {
    function renderLoop() {
      rafId.current = requestAnimationFrame(renderLoop);
      if (!needsRender.current) return;
      needsRender.current = false;

      const display = displayRef.current;
      const committed = committedRef.current;
      const temp = tempRef.current;
      if (!display || !committed || !temp) return;

      const ctx = display.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.drawImage(committed, 0, 0);

      if (isDrawing.current) {
        ctx.globalAlpha = 1.0;
        ctx.drawImage(temp, 0, 0);
        ctx.globalAlpha = 1.0;
      }
    }

    rafId.current = requestAnimationFrame(renderLoop);
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // ─── Pointer handlers ───
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isActive || !isAdmin) return;
      e.preventDefault();
      e.stopPropagation();

      const canvas = displayRef.current;
      if (canvas) canvas.setPointerCapture(e.pointerId);

      const temp = tempRef.current;
      if (temp) {
        const ctx = temp.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      }

      const rect = displayRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Pencil button mode: constrain to original range (world y 0–4000 = canvas-local y 2000–6000)
      if (!devDrawMode && y < -CANVAS_Y_OFFSET) return;

      const isMouse = e.pointerType === "mouse";
      const pressure = isMouse ? 0.45 : Math.max(0.1, e.pressure);
      const tiltX = isMouse ? undefined : (e.tiltX || undefined);
      const tiltY = isMouse ? undefined : (e.tiltY || undefined);

      const pt: Point = { x, y, pressure, tiltX, tiltY };
      isDrawing.current = true;
      currentPoints.current = [pt];
      lastPoint.current = pt;
      lastTime.current = performance.now();

      if (temp) {
        const ctx = temp.getContext("2d");
        if (ctx) stamp(ctx, pt);
      }
      needsRender.current = true;
    },
    [isActive, isAdmin, stamp]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current || !lastPoint.current) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = displayRef.current?.getBoundingClientRect();
      if (!rect) return;

      const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];

      const temp = tempRef.current;
      const ctx = temp?.getContext("2d");
      if (!ctx) return;

      for (const ev of events) {
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;

        const now = performance.now();
        const dt = now - lastTime.current;
        const isMouse = ev.pointerType === "mouse";

        let pressure: number;
        if (isMouse) {
          const dx = x - lastPoint.current!.x;
          const dy = y - lastPoint.current!.y;
          pressure = pressureFromSpeed(dx, dy, dt);
        } else {
          pressure = Math.max(0.1, ev.pressure);
        }

        const tiltX = isMouse ? undefined : (ev.tiltX || undefined);
        const tiltY = isMouse ? undefined : (ev.tiltY || undefined);

        const pt: Point = { x, y, pressure, tiltX, tiltY };
        const stampPts = getStampPoints(lastPoint.current!, pt);

        for (const s of stampPts) {
          stamp(ctx, s);
        }

        currentPoints.current.push(pt);
        lastPoint.current = pt;
        lastTime.current = now;
      }

      needsRender.current = true;
    },
    [stamp]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      e.stopPropagation();

      isDrawing.current = false;
      lastPoint.current = null;

      // Composite temp onto committed
      const committed = committedRef.current;
      const temp = tempRef.current;
      if (committed && temp) {
        const ctx = committed.getContext("2d");
        if (ctx) {
          ctx.globalAlpha = 1.0;
          ctx.drawImage(temp, 0, 0);
          ctx.globalAlpha = 1.0;
        }
        const tempCtx = temp.getContext("2d");
        if (tempCtx) tempCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      }

      needsRender.current = true;

      if (currentPoints.current.length > 1 && onStrokeComplete) {
        onStrokeComplete({ points: [...currentPoints.current] });
      }
      currentPoints.current = [];
    },
    [onStrokeComplete]
  );

  // ─── Render ───

  const canvasStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: CANVAS_W,
    height: CANVAS_H,
  };

  const hasStrokes = strokes && strokes.length > 0;
  const shouldRender = isAdmin || hasStrokes;
  if (!shouldRender) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: CANVAS_Y_OFFSET,
        left: 0,
        width: CANVAS_W,
        height: CANVAS_H,
        zIndex: 3,
        pointerEvents: isActive && isAdmin ? "auto" : "none",
        touchAction: "none",
      }}
    >
      <canvas
        ref={committedRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ ...canvasStyle, visibility: "hidden" }}
      />
      <canvas
        ref={tempRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ ...canvasStyle, visibility: "hidden" }}
      />
      <canvas
        ref={displayRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ ...canvasStyle, visibility: "visible" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}
