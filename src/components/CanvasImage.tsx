"use client";

import React, { useCallback, useRef, useState } from 'react';
import { XIcon, RotateCwIcon, MoveIcon, MaximizeIcon } from 'lucide-react';
import { CanvasImageData } from '../hooks/useCanvasImages';

interface CanvasImageProps {
  data: CanvasImageData;
  onUpdate: (id: string, updates: Partial<CanvasImageData>) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

export function CanvasImage({ data, onUpdate, onDelete, disabled }: CanvasImageProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selected, setSelected] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click-outside to deselect
  React.useEffect(() => {
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
    startMouseX: number;
    startMouseY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const onMoveDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      dragState.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: data.x,
        startY: data.y,
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
  const resizeState = useRef<{
    startMouseX: number;
    startW: number;
  } | null>(null);

  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      resizeState.current = {
        startMouseX: e.clientX,
        startW: data.width,
      };
      const aspect = data.naturalWidth / data.naturalHeight;
      const onMove = (me: PointerEvent) => {
        if (!resizeState.current) return;
        const dx = me.clientX - resizeState.current.startMouseX;
        const newW = Math.max(60, Math.min(1200, resizeState.current.startW + dx));
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
    [data.id, data.width, data.naturalWidth, data.naturalHeight, onUpdate]
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
    width: 26,
    height: 26,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: '#44403c',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.1s',
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
        zIndex: isDragging ? 200 : selected ? 50 : 8,
        transform: `rotate(${data.rotation}deg)`,
        transformOrigin: 'center center',
        pointerEvents: disabled ? 'none' : 'auto',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Toolbar — visible when selected */}
      {selected && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            background: '#f5f0e8',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 6,
            padding: '3px 5px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            whiteSpace: 'nowrap',
          }}
        >
          {/* Move */}
          <div
            onPointerDown={onMoveDown}
            style={{ ...tbBtn(), cursor: isDragging ? 'grabbing' : 'grab' }}
            title="Move"
          >
            <MoveIcon style={{ width: 14, height: 14 }} />
          </div>

          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)' }} />

          {/* Resize */}
          <div
            onPointerDown={onResizeDown}
            style={{ ...tbBtn(), cursor: 'nwse-resize' }}
            title="Resize (drag)"
          >
            <MaximizeIcon style={{ width: 14, height: 14 }} />
          </div>

          {/* Rotate */}
          <div
            onPointerDown={onRotateDown}
            style={{ ...tbBtn(), cursor: 'grab' }}
            title="Rotate (drag)"
          >
            <RotateCwIcon style={{ width: 14, height: 14 }} />
          </div>

          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)' }} />

          {/* Delete */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(data.id); }}
            style={{ ...tbBtn(), color: '#ef4444' }}
            title="Delete"
          >
            <XIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}

      {/* Selection border */}
      {selected && (
        <div
          style={{
            position: 'absolute',
            inset: -2,
            border: '2px dashed rgba(68,64,60,0.4)',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* The image — click to select */}
      <img
        src={data.src}
        alt="Canvas image"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          cursor: 'pointer',
          userSelect: 'none',
          display: 'block',
        }}
        draggable={false}
        onClick={() => setSelected(true)}
      />
    </div>
  );
}
