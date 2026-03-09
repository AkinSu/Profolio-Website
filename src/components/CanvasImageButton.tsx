"use client";

import React, { useCallback, useRef, useState } from 'react';
import { XIcon, MoveIcon, LinkIcon, MaximizeIcon } from 'lucide-react';
import { CanvasImageButtonData } from '../hooks/useCanvasButtons';

interface CanvasImageButtonProps {
  data: CanvasImageButtonData;
  onUpdate: (id: string, updates: Partial<CanvasImageButtonData>) => void;
  onLock: (id: string) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
  devMode?: boolean;
  cursorMode?: string | null;
}

export function CanvasImageButton({ data, onUpdate, onLock, onDelete, disabled, devMode, cursorMode }: CanvasImageButtonProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selected, setSelected] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click-outside to deselect / lock
  React.useEffect(() => {
    if (!selected && !data.isEditing) return;
    function handleDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        if (data.isEditing) onLock(data.id);
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
  }, [selected, data.isEditing, data.id, onLock]);

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
  const resizeState = useRef<{ startMouseX: number; startW: number } | null>(null);

  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      resizeState.current = { startMouseX: e.clientX, startW: data.width };
      const aspect = data.naturalWidth / data.naturalHeight;
      const onMove = (me: PointerEvent) => {
        if (!resizeState.current) return;
        const dx = me.clientX - resizeState.current.startMouseX;
        const newW = Math.max(40, Math.min(800, resizeState.current.startW + dx));
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

  const handleImageClick = () => {
    if (data.isEditing) return;
    // Hand cursor: navigate directly, no select step
    if (cursorMode === 'hand' && !devMode && data.href) {
      window.open(data.href, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!selected) {
      setSelected(true);
    } else if (data.href && !devMode) {
      window.open(data.href, '_blank', 'noopener,noreferrer');
    }
  };

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
        zIndex: isDragging ? 200 : data.isEditing || selected ? 50 : 8,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Toolbar */}
      {(selected || data.isEditing) && (
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
          <div onPointerDown={onMoveDown} style={{ ...tbBtn(), cursor: isDragging ? 'grabbing' : 'grab' }} title="Move">
            <MoveIcon style={{ width: 14, height: 14 }} />
          </div>
          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)' }} />
          <div onPointerDown={onResizeDown} style={{ ...tbBtn(), cursor: 'nwse-resize' }} title="Resize (drag)">
            <MaximizeIcon style={{ width: 14, height: 14 }} />
          </div>
          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)' }} />
          <button onClick={(e) => { e.stopPropagation(); onDelete(data.id); }} style={{ ...tbBtn(), color: '#ef4444' }} title="Delete">
            <XIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}

      {/* Editing: show href input */}
      {data.isEditing && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: '#f5f0e8',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 6,
            padding: '4px 8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            whiteSpace: 'nowrap',
          }}
        >
          <LinkIcon style={{ width: 14, height: 14, color: 'rgba(0,0,0,0.4)', flexShrink: 0 }} />
          <input
            type="text"
            value={data.href}
            onChange={(e) => onUpdate(data.id, { href: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onLock(data.id); } }}
            placeholder="https://..."
            autoFocus
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              color: '#44403c',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px dashed rgba(0,0,0,0.2)',
              outline: 'none',
              minWidth: 160,
              padding: '2px 2px',
            }}
          />
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

      {/* The image */}
      <img
        role="button"
        src={data.src}
        alt="Button image"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          cursor: data.href ? 'pointer' : 'default',
          userSelect: 'none',
          display: 'block',
          transition: 'transform 0.15s ease',
          transform: isHovered && !data.isEditing ? 'rotate(-1.5deg) scale(1.02)' : 'none',
        }}
        draggable={false}
        onClick={handleImageClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
    </div>
  );
}
