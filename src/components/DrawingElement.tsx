"use client";

import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { XIcon, RotateCwIcon, MoveIcon, MaximizeIcon } from 'lucide-react';
import { decodeStroke, type CompressedStroke } from '@/lib/strokeCompression';

// ─── Brush rendering (mirrors PencilCanvas stamp engine) ───

function paperGrain(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

const TIP_SIZE = 14;

let cachedTip: HTMLCanvasElement | null = null;
function getGraphiteTip(): HTMLCanvasElement {
  if (cachedTip) return cachedTip;
  const c = document.createElement("canvas");
  c.width = c.height = TIP_SIZE;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(TIP_SIZE, TIP_SIZE);
  const center = TIP_SIZE / 2;
  const radius = TIP_SIZE / 2;
  for (let y = 0; y < TIP_SIZE; y++) {
    for (let x = 0; x < TIP_SIZE; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx * 1.0 + dy * dy * 1.5);
      const edgeNoise = 0.85 + paperGrain(x * 3.7, y * 3.7) * 0.3;
      const effectiveRadius = radius * edgeNoise;
      const i = (y * TIP_SIZE + x) * 4;
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
  cachedTip = c;
  return c;
}

interface Point {
  x: number; y: number; pressure: number;
  tiltX?: number; tiltY?: number;
}

function stampPoint(ctx: CanvasRenderingContext2D, tip: HTMLCanvasElement, pt: Point) {
  const grain = paperGrain(pt.x * 0.5, pt.y * 0.5);
  const grainFloor = 0.4 + pt.pressure * 0.35;
  const grainMultiplier = grainFloor + grain * (1.0 - grainFloor);

  const tiltX = pt.tiltX || 0;
  const tiltY = pt.tiltY || 0;
  const tiltMag = Math.sqrt(tiltX * tiltX + tiltY * tiltY);
  const tiltNorm = Math.min(tiltMag / 60, 1);
  const tiltAngle = Math.atan2(tiltY, tiltX);

  const baseScale = 0.7 + pt.pressure * 0.35;
  const scaleX = baseScale * (1 + tiltNorm * 2.0);
  const scaleY = baseScale * (1 - tiltNorm * 0.3);

  const baseAlpha = 0.20 + pt.pressure * 0.60;
  const jitter = 0.9 + Math.random() * 0.1;
  const alpha = baseAlpha * jitter * grainMultiplier * (1 - tiltNorm * 0.4);

  const scatterX = (Math.random() - 0.5) * 0.8;
  const scatterY = (Math.random() - 0.5) * 0.8;
  const rotation = (Math.random() - 0.5) * 0.5 + tiltAngle * tiltNorm;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(pt.x + scatterX, pt.y + scatterY);
  ctx.rotate(rotation);
  ctx.scale(scaleX / baseScale, scaleY / baseScale);
  ctx.drawImage(
    tip,
    -(TIP_SIZE * baseScale) / 2,
    -(TIP_SIZE * baseScale) / 2,
    TIP_SIZE * baseScale,
    TIP_SIZE * baseScale
  );
  ctx.restore();
}

function getStampPoints(prev: Point, curr: Point, spacing = 2): Point[] {
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

// ─── Types ───

export interface DrawingElementData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  strokes: CompressedStroke[];
}

interface DrawingElementProps {
  data: DrawingElementData;
  onUpdate: (id: string, updates: Partial<DrawingElementData>) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

// ─── Component ───

export function DrawingElement({ data, onUpdate, onDelete, disabled, readOnly }: DrawingElementProps) {
  const [selected, setSelected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedKey = useRef<string>("");

  // Stable key for stroke data to avoid re-rendering
  const strokeKey = useMemo(() => {
    return data.strokes.map(s => s.d.length).join(',') + `_${data.width}_${data.height}`;
  }, [data.strokes, data.width, data.height]);

  // Render strokes onto the canvas
  useEffect(() => {
    if (renderedKey.current === strokeKey) return;
    renderedKey.current = strokeKey;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tip = getGraphiteTip();
    ctx.clearRect(0, 0, data.width, data.height);

    for (const compressed of data.strokes) {
      // Decode relative to (0,0) since canvas is positioned at (data.x, data.y)
      const points = decodeStroke(compressed, 0, 0);
      if (points.length < 2) continue;

      for (let i = 1; i < points.length; i++) {
        const stamps = getStampPoints(points[i - 1], points[i]);
        for (const pt of stamps) {
          stampPoint(ctx, tip, pt);
        }
      }
    }
  }, [strokeKey, data.strokes, data.width, data.height]);

  // Click-outside to deselect
  useEffect(() => {
    if (!selected) return;
    function handleDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setSelected(false);
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleDown);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleDown);
    };
  }, [selected]);

  // --- Drag to move ---
  const dragState = useRef<{
    startMouseX: number; startMouseY: number;
    startX: number; startY: number;
  } | null>(null);

  const onMoveDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      dragState.current = {
        startMouseX: e.clientX, startMouseY: e.clientY,
        startX: data.x, startY: data.y,
      };
      const onMove = (me: PointerEvent) => {
        if (!dragState.current) return;
        onUpdate(data.id, {
          x: dragState.current.startX + (me.clientX - dragState.current.startMouseX),
          y: dragState.current.startY + (me.clientY - dragState.current.startMouseY),
        });
      };
      const onUp = () => {
        dragState.current = null;
        setIsDragging(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [data.id, data.x, data.y, onUpdate]
  );

  // --- Resize ---
  const resizeState = useRef<{ startMouseX: number; startW: number } | null>(null);

  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      resizeState.current = { startMouseX: e.clientX, startW: data.width };
      const aspect = data.width / data.height;
      const onMove = (me: PointerEvent) => {
        if (!resizeState.current) return;
        const dx = me.clientX - resizeState.current.startMouseX;
        const newW = Math.max(20, Math.min(2000, resizeState.current.startW + dx));
        onUpdate(data.id, { width: newW, height: newW / aspect });
      };
      const onUp = () => {
        resizeState.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [data.id, data.width, data.height, onUpdate]
  );

  // --- Rotate ---
  const onRotateDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
      const baseRotation = data.rotation;
      const onMove = (me: PointerEvent) => {
        const cur = Math.atan2(me.clientY - cy, me.clientX - cx) * (180 / Math.PI);
        onUpdate(data.id, { rotation: baseRotation + (cur - startAngle) });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [data.id, data.rotation, onUpdate]
  );

  const tbBtn = (): React.CSSProperties => ({
    width: 26, height: 26, borderRadius: 4, border: 'none',
    background: 'transparent', color: '#44403c',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', padding: 0, transition: 'background 0.1s',
  });

  return (
    <div
      ref={wrapperRef}
      className="absolute select-none"
      style={{
        left: data.x,
        top: data.y,
        width: data.width,
        height: data.height,
        zIndex: isDragging ? 200 : selected ? 50 : 3,
        transform: `rotate(${data.rotation}deg)`,
        transformOrigin: 'center center',
        pointerEvents: disabled ? 'none' : 'auto',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Toolbar — admin only, when selected */}
      {selected && !readOnly && (
        <div
          style={{
            position: 'absolute', bottom: '100%', left: '50%',
            transform: 'translateX(-50%)', marginBottom: 6,
            display: 'flex', alignItems: 'center', gap: 3,
            background: '#f5f0e8', border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 6, padding: '3px 5px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)', whiteSpace: 'nowrap',
          }}
        >
          <div onPointerDown={onMoveDown} style={{ ...tbBtn(), cursor: isDragging ? 'grabbing' : 'grab' }} title="Move">
            <MoveIcon style={{ width: 14, height: 14 }} />
          </div>
          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)' }} />
          <div onPointerDown={onResizeDown} style={{ ...tbBtn(), cursor: 'nwse-resize' }} title="Resize (drag)">
            <MaximizeIcon style={{ width: 14, height: 14 }} />
          </div>
          <div onPointerDown={onRotateDown} style={{ ...tbBtn(), cursor: 'grab' }} title="Rotate (drag)">
            <RotateCwIcon style={{ width: 14, height: 14 }} />
          </div>
          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)' }} />
          <button onClick={(e) => { e.stopPropagation(); onDelete(data.id); }} style={{ ...tbBtn(), color: '#ef4444' }} title="Delete">
            <XIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}

      {/* Selection border */}
      {selected && (
        <div style={{
          position: 'absolute', inset: -2,
          border: '2px dashed rgba(68,64,60,0.4)', borderRadius: 4,
          pointerEvents: 'none',
        }} />
      )}

      {/* The drawing canvas — click to select (admin only) */}
      <canvas
        ref={canvasRef}
        width={data.width}
        height={data.height}
        style={{
          width: '100%', height: '100%',
          cursor: readOnly ? 'default' : 'pointer',
          userSelect: 'none', display: 'block',
        }}
        onClick={() => { if (!readOnly) setSelected(true); }}
      />
    </div>
  );
}
