"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { XIcon, BoldIcon, RotateCwIcon, MoveIcon, LinkIcon, AArrowUpIcon, Link2OffIcon } from 'lucide-react';
import { CanvasTextButtonData, BUTTON_COLORS } from '../hooks/useCanvasButtons';

interface LinkableElement {
  id: string;
  type: string;
  label: string;
}

interface CanvasTextButtonProps {
  data: CanvasTextButtonData;
  onUpdate: (id: string, updates: Partial<CanvasTextButtonData>) => void;
  onLock: (id: string) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
  devMode?: boolean;
  readOnly?: boolean;
  linkableElements?: LinkableElement[];
  onPanToElement?: (elementId: string) => void;
}

export function CanvasTextButton({ data, onUpdate, onLock, onDelete, disabled, devMode, readOnly, linkableElements, onPanToElement }: CanvasTextButtonProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragState = useRef<{
    startMouseX: number;
    startMouseY: number;
    startX: number;
    startY: number;
  } | null>(null);

  // Track link mode as local state so the toggle works even when both fields are empty
  const [linkMode, setLinkMode] = useState<'url' | 'element'>(data.linkedElementId ? 'element' : 'url');

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

  const handleTextClick = () => {
    if (readOnly) {
      if (data.linkedElementId) {
        onPanToElement?.(data.linkedElementId);
        return;
      }
      if (data.href) {
        window.open(data.href, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    if (devMode) {
      setShowToolbar(true);
      return;
    }
    if (!data.isEditing && !showToolbar) {
      if (data.linkedElementId) {
        onPanToElement?.(data.linkedElementId);
        return;
      }
      if (data.href) {
        window.open(data.href, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleDoubleClick = () => {
    if (readOnly) return;
    if (!data.isEditing) {
      onUpdate(data.id, { isEditing: true });
      setShowToolbar(false);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    if (!data.isEditing) setShowToolbar(true);
  };

  const hasLink = !!(data.href || data.linkedElementId);
  const fontWeight = data.bold ? 700 : 400;
  const pad = Math.max(6, Math.round(data.fontSize * 0.25));

  // Find linked element label
  const linkedLabel = data.linkedElementId
    ? linkableElements?.find(e => e.id === data.linkedElementId)?.label
    : undefined;

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

  const segBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '3px 0',
    background: active ? 'rgba(0,0,0,0.12)' : 'transparent',
    color: active ? '#44403c' : 'rgba(0,0,0,0.35)',
    border: `1px solid ${active ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: 4,
    fontSize: 10,
    fontFamily: 'monospace',
    cursor: 'pointer',
  });

  return (
    <div
      ref={wrapperRef}
      className="absolute select-none"
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
      onContextMenu={handleRightClick}
    >
      {/* Toolbar (admin only) */}
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
          <div onPointerDown={onMoveDown} style={{ ...tbBtn(), cursor: isDragging ? 'grabbing' : 'grab' }} title="Move">
            <MoveIcon style={{ width: 14, height: 14 }} />
          </div>
          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)' }} />
          <button onClick={(e) => { e.stopPropagation(); onUpdate(data.id, { bold: !data.bold }); }} style={tbBtn(data.bold)} title="Bold">
            <BoldIcon style={{ width: 14, height: 14 }} />
          </button>
          <div onPointerDown={onRotateDown} style={{ ...tbBtn(), cursor: 'grab' }} title="Rotate (drag)">
            <RotateCwIcon style={{ width: 14, height: 14 }} />
          </div>
          <div onPointerDown={onResizeDown} style={{ ...tbBtn(), cursor: 'ew-resize' }} title="Resize (drag)">
            <AArrowUpIcon style={{ width: 14, height: 14 }} />
          </div>
          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)' }} />
          {BUTTON_COLORS.map((c) => (
            <button
              key={c}
              onClick={(e) => { e.stopPropagation(); onUpdate(data.id, { color: c }); }}
              style={{
                width: 16, height: 16, borderRadius: '50%', background: c,
                border: data.color === c ? '2px solid rgba(0,0,0,0.5)' : '1.5px solid rgba(0,0,0,0.12)',
                cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
              title={c}
            />
          ))}
          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)' }} />
          <button onClick={(e) => { e.stopPropagation(); onDelete(data.id); }} style={{ ...tbBtn(), color: '#ef4444' }} title="Delete">
            <XIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}

      {data.isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            ref={inputRef}
            type="text"
            value={data.text}
            onChange={(e) => onUpdate(data.id, { text: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="Button text..."
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

          {/* Link type toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
            <button
              onClick={() => { setLinkMode('url'); onUpdate(data.id, { linkedElementId: '' }); }}
              style={segBtn(linkMode === 'url')}
            >
              URL
            </button>
            <button
              onClick={() => { setLinkMode('element'); onUpdate(data.id, { href: '' }); }}
              style={segBtn(linkMode === 'element')}
            >
              Element
            </button>
          </div>

          {linkMode === 'url' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <LinkIcon style={{ width: 14, height: 14, color: 'rgba(0,0,0,0.4)', flexShrink: 0 }} />
              <input
                type="text"
                value={data.href}
                onChange={(e) => onUpdate(data.id, { href: e.target.value, linkedElementId: '' })}
                onKeyDown={handleKeyDown}
                placeholder="https://..."
                style={{
                  fontFamily: "monospace",
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
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <select
                value={data.linkedElementId || ''}
                onChange={(e) => onUpdate(data.id, { linkedElementId: e.target.value, href: '' })}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: '#44403c',
                  background: '#f5f0e8',
                  border: '1px solid rgba(0,0,0,0.15)',
                  borderRadius: 4,
                  outline: 'none',
                  padding: '3px 4px',
                  minWidth: 160,
                  cursor: 'pointer',
                }}
              >
                <option value="">Select element...</option>
                {linkableElements
                  ?.filter(e => e.id !== data.id)
                  .map(e => (
                    <option key={e.id} value={e.id}>
                      {e.type.replace('_', ' ')} — {e.label}
                    </option>
                  ))
                }
              </select>
              {data.linkedElementId && (
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdate(data.id, { linkedElementId: '' }); }}
                  title="Unlink"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Link2OffIcon style={{ width: 14, height: 14 }} />
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          role="button"
          onClick={handleTextClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            position: 'relative',
            cursor: hasLink ? 'pointer' : 'default',
            padding: `${pad}px ${pad * 1.5}px`,
            borderRadius: 4,
            border: isHovered ? `2px solid ${data.color}` : '2px solid transparent',
            background: isHovered ? data.color : 'transparent',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          <p
            style={{
              fontFamily: "'PaperHand', cursive",
              fontSize: data.fontSize,
              fontWeight,
              color: isHovered ? '#f5f5f0' : data.color,
              whiteSpace: 'pre',
              lineHeight: 1.3,
              transition: 'color 0.2s',
            }}
          >
            {data.text}
          </p>
          {/* Show linked element indicator when not editing */}
          {data.linkedElementId && linkedLabel && !readOnly && (
            <span style={{
              position: 'absolute',
              bottom: -16,
              left: 0,
              fontSize: 9,
              fontFamily: 'monospace',
              color: 'rgba(0,0,0,0.35)',
              whiteSpace: 'nowrap',
            }}>
              → {linkedLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
