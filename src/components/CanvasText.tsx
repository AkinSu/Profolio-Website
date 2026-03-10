"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { XIcon, BoldIcon, RotateCwIcon, MoveIcon, AArrowUpIcon } from 'lucide-react';
import { CanvasTextData, TEXT_COLORS } from '../hooks/useCanvasTexts';

interface CanvasTextProps {
  data: CanvasTextData;
  onUpdate: (id: string, updates: Partial<CanvasTextData>) => void;
  onLock: (id: string) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export function CanvasText({ data, onUpdate, onLock, onDelete, disabled, readOnly }: CanvasTextProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragState = useRef<{
    startMouseX: number;
    startMouseY: number;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    if (data.isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [data.isEditing]);

  // Click-outside to lock and hide toolbar
  useEffect(() => {
    if (!data.isEditing && !showToolbar) return;
    function handleDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        if (data.isEditing) onLock(data.id);
        setShowToolbar(false);
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleDown);
    }, 150);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleDown);
    };
  }, [data.isEditing, showToolbar, data.id, onLock]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onLock(data.id);
    }
  };

  // Drag-to-move
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

  // Rotate
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

  // Resize (font size)
  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX;
      const startSize = data.fontSize;
      const onMove = (me: PointerEvent) => {
        const dx = me.clientX - startX;
        const newSize = Math.max(14, Math.min(120, startSize + dx * 0.5));
        onUpdate(data.id, { fontSize: Math.round(newSize) });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [data.id, data.fontSize, onUpdate]
  );

  // Click text to show toolbar
  const handleTextClick = () => {
    if (!data.isEditing && !readOnly) setShowToolbar(true);
  };

  const handleDoubleClick = () => {
    if (!data.isEditing && !readOnly) {
      onUpdate(data.id, { isEditing: true });
      setShowToolbar(false);
    }
  };

  const fontWeight = data.bold ? 700 : 400;

  // Toolbar button style helper
  const tbBtn = (active?: boolean): React.CSSProperties => ({
    width: 26,
    height: 26,
    borderRadius: 4,
    border: 'none',
    background: active ? 'rgba(0,0,0,0.15)' : 'transparent',
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
      className="absolute select-none canvas-text-wrapper"
      style={{
        left: data.x,
        top: data.y,
        zIndex: isDragging ? 200 : data.isEditing ? 100 : showToolbar ? 50 : 5,
        transform: `rotate(${data.rotation}deg)`,
        transformOrigin: 'center center',
        pointerEvents: disabled ? 'none' : 'auto',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={handleDoubleClick}
    >
      {/* Toolbar — visible when editing or when clicked (admin only) */}
      {!readOnly && (data.isEditing || showToolbar) && (
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
          {/* Move handle */}
          <div
            onPointerDown={onMoveDown}
            style={{ ...tbBtn(), cursor: isDragging ? 'grabbing' : 'grab' }}
            title="Move"
          >
            <MoveIcon style={{ width: 14, height: 14 }} />
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)' }} />

          {/* Bold */}
          <button
            onClick={(e) => { e.stopPropagation(); onUpdate(data.id, { bold: !data.bold }); }}
            style={tbBtn(data.bold)}
            title="Bold"
          >
            <BoldIcon style={{ width: 14, height: 14 }} />
          </button>

          {/* Rotate */}
          <div
            onPointerDown={onRotateDown}
            style={{ ...tbBtn(), cursor: 'grab' }}
            title="Rotate (drag)"
          >
            <RotateCwIcon style={{ width: 14, height: 14 }} />
          </div>

          {/* Resize */}
          <div
            onPointerDown={onResizeDown}
            style={{ ...tbBtn(), cursor: 'ew-resize' }}
            title="Resize (drag)"
          >
            <AArrowUpIcon style={{ width: 14, height: 14 }} />
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)' }} />

          {/* Color dots */}
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              onClick={(e) => { e.stopPropagation(); onUpdate(data.id, { color: c }); }}
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: c,
                border: data.color === c ? '2px solid rgba(0,0,0,0.5)' : '1.5px solid rgba(0,0,0,0.12)',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
              }}
              title={c}
            />
          ))}

          {/* Divider */}
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

      {data.isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={data.text}
          onChange={(e) => onUpdate(data.id, { text: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="Type here..."
          style={{
            fontFamily: "'PaperHand', cursive",
            fontSize: data.fontSize,
            fontWeight,
            color: data.color,
            background: 'transparent',
            border: 'none',
            borderBottom: `2px dashed ${data.color}40`,
            outline: 'none',
            minWidth: 120,
            padding: '4px 2px',
          }}
        />
      ) : (
        <div onClick={handleTextClick} style={{ position: 'relative', cursor: 'pointer' }}>
          <p
            style={{
              fontFamily: "'PaperHand', cursive",
              fontSize: data.fontSize,
              fontWeight,
              color: data.color,
              whiteSpace: 'pre',
              lineHeight: 1.3,
              padding: '4px 2px',
            }}
          >
            {data.text}
          </p>
        </div>
      )}
    </div>
  );
}
