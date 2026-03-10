"use client";

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ImagePlusIcon, CheckIcon, XIcon, BoldIcon, ItalicIcon, AlignCenterIcon, LoaderIcon } from 'lucide-react';
import { StickyNoteData } from '../hooks/useStickyNotes';
import { uploadFiles } from '@/lib/uploadthing';
const TACK_IMG = "/tack.png";

interface StickyNoteProps {
  note: StickyNoteData;
  onUpdate: (id: string, updates: Partial<StickyNoteData>) => void;
  onLock: (id: string) => void;
  onDelete: (id: string) => void;
  cursorMode?: string | null;
  devMode?: boolean;
  readOnly?: boolean;
}
export function StickyNote({
  note,
  onUpdate,
  onLock,
  onDelete,
  cursorMode,
  devMode,
  readOnly
}: StickyNoteProps) {
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleMeasureRef = useRef<HTMLSpanElement>(null);
  const rotateState = useRef<{
    active: boolean;
    startAngle: number;
    pivotX: number;
    pivotY: number;
    lastAngle: number;
    lastTime: number;
  } | null>(null);
  const dragState = useRef<{
    startMouseX: number;
    startMouseY: number;
    startNoteX: number;
    startNoteY: number;
  } | null>(null);
  const resizeState = useRef<{
    startMouseX: number;
    startWidth: number;
  } | null>(null);
  const physicsRef = useRef<{
    angle: number;
    velocity: number;
    animId: number | null;
  }>({
    angle: 0,
    velocity: 0,
    animId: null
  });
  // Damped pendulum physics simulation
  const startPhysicsSwing = useCallback(
    (initialAngle: number, initialVelocity: number) => {
      // Cancel any existing animation
      if (physicsRef.current.animId !== null) {
        cancelAnimationFrame(physicsRef.current.animId);
      }
      const STIFFNESS = 0.08; // Spring force — pulls toward 0
      const DAMPING = 0.94; // Velocity decay per frame — closer to 1 = bouncier
      const GRAVITY_FACTOR = 0.02; // Extra pull proportional to sin(angle) for pendulum feel
      const STOP_THRESHOLD = 0.15; // Stop when both angle and velocity are tiny
      const VELOCITY_THRESHOLD = 0.05;
      let angle = initialAngle;
      // Add release velocity — the faster you fling, the more momentum
      let velocity = initialVelocity * 0.3;
      const tick = () => {
        // Spring restoring force: F = -k * x
        const springForce = -STIFFNESS * angle;
        // Pendulum gravity component: stronger pull at higher angles
        // sin(angle) makes it nonlinear — bigger angles swing harder
        const gravityForce =
        -GRAVITY_FACTOR * Math.sin(angle * Math.PI / 180) * Math.abs(angle);
        // Apply forces to velocity
        velocity += springForce + gravityForce;
        // Apply damping (friction)
        velocity *= DAMPING;
        // Update angle
        angle += velocity;
        setRotation(angle);
        // Check if settled
        if (
        Math.abs(angle) < STOP_THRESHOLD &&
        Math.abs(velocity) < VELOCITY_THRESHOLD)
        {
          setRotation(0);
          physicsRef.current = {
            angle: 0,
            velocity: 0,
            animId: null
          };
          return;
        }
        physicsRef.current.angle = angle;
        physicsRef.current.velocity = velocity;
        physicsRef.current.animId = requestAnimationFrame(tick);
      };
      physicsRef.current = {
        angle,
        velocity,
        animId: requestAnimationFrame(tick)
      };
    },
    []
  );
  // Cleanup physics on unmount
  useEffect(() => {
    return () => {
      if (physicsRef.current.animId !== null) {
        cancelAnimationFrame(physicsRef.current.animId);
      }
    };
  }, []);
  // Inject tilt handle cursor style (once, shared across all notes)
  // Re-append on every mount to ensure it stays after the global cursor style
  useEffect(() => {
    let s = document.getElementById('tilt-cursor-style') as HTMLStyleElement | null;
    if (!s) {
      s = document.createElement('style');
      s.id = 'tilt-cursor-style';
    }
    s.textContent = `div.tilt-handle, div.tilt-handle * { cursor: url(/hand-hover.png) 16 16, grab !important; }`;
    document.head.appendChild(s);
  }, []);

  // Click-outside to lock
  useEffect(() => {
    if (!note.isEditing) return;
    function handleDown(e: MouseEvent) {
      if (
      wrapperRef.current &&
      !wrapperRef.current.contains(e.target as Node))
      {
        onLock(note.id);
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleDown);
    }, 150);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleDown);
    };
  }, [note.isEditing, note.id, onLock]);

  // Auto-expand note width to fit title text
  useEffect(() => {
    const el = titleMeasureRef.current;
    if (!el) return;
    const padding = Math.round(note.width * 0.05) * 2;
    const needed = el.scrollWidth + padding + 4; // 4px buffer
    if (needed > note.width) {
      onUpdate(note.id, { width: Math.min(600, needed) });
    }
  }, [note.topText, note.topBold, note.topItalic, note.width, note.id, onUpdate]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isGif = file.type === 'image/gif';
    const mediaType = isVideo ? 'video' as const : isGif ? 'gif' as const : 'image' as const;

    // Videos can't be uploaded via UploadThing image endpoint — use blob URL as fallback
    if (isVideo) {
      const url = URL.createObjectURL(file);
      const vid = document.createElement('video');
      vid.onloadedmetadata = () => {
        const newWidth = Math.max(note.width, Math.min(500, vid.videoWidth));
        onUpdate(note.id, { imageUrl: url, mediaType, width: newWidth });
      };
      vid.src = url;
      return;
    }

    setIsUploadingMedia(true);
    try {
      const [uploaded] = await uploadFiles("canvasImage", { files: [file] });
      console.log('UploadThing response:', JSON.stringify(uploaded, null, 2));
      const url = uploaded.url ?? uploaded.ufsUrl ?? (uploaded.serverData as Record<string, unknown>)?.url;
      if (!url) { console.error('No URL in upload response:', uploaded); setIsUploadingMedia(false); return; }
      const img = new window.Image();
      img.onload = () => {
        const newWidth = Math.max(note.width, Math.min(500, img.naturalWidth));
        onUpdate(note.id, { imageUrl: url, mediaType, width: newWidth });
        setIsUploadingMedia(false);
      };
      img.onerror = () => setIsUploadingMedia(false);
      img.src = url;
    } catch (err) {
      console.error('Sticky note image upload failed:', err);
      setIsUploadingMedia(false);
    }
  };
  // --- Drag-to-move via thumb tack ---
  const onTackPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (note.isEditing) return;
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      dragState.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startNoteX: note.x,
        startNoteY: note.y
      };
      const onMove = (me: PointerEvent) => {
        if (!dragState.current) return;
        const dx = me.clientX - dragState.current.startMouseX;
        const dy = me.clientY - dragState.current.startMouseY;
        onUpdate(note.id, {
          x: dragState.current.startNoteX + dx,
          y: dragState.current.startNoteY + dy
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
    [note.isEditing, note.id, note.x, note.y, onUpdate]
  );
  // --- Rotation logic with velocity tracking ---
  const onCornerDown = useCallback(
    (e: React.PointerEvent) => {
      if (note.isEditing) return;
      e.stopPropagation();
      e.preventDefault();
      // Cancel any ongoing physics animation
      if (physicsRef.current.animId !== null) {
        cancelAnimationFrame(physicsRef.current.animId);
        physicsRef.current.animId = null;
      }
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pivotX = rect.left + rect.width / 2;
      const pivotY = rect.top;
      const startAngle =
      Math.atan2(e.clientY - pivotY, e.clientX - pivotX) * (180 / Math.PI);
      rotateState.current = {
        active: true,
        startAngle,
        pivotX,
        pivotY,
        lastAngle: 0,
        lastTime: performance.now()
      };
      const onMove = (me: PointerEvent) => {
        if (!rotateState.current?.active) return;
        const { startAngle: sa, pivotX: px, pivotY: py } = rotateState.current;
        const currentAngle =
        Math.atan2(me.clientY - py, me.clientX - px) * (180 / Math.PI);
        let diff = currentAngle - sa;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        diff = Math.max(-60, Math.min(60, diff));
        // Track angular velocity for release momentum
        const now = performance.now();
        const dt = now - rotateState.current.lastTime;
        if (dt > 0) {
          rotateState.current.lastTime = now;
          rotateState.current.lastAngle = diff;
        }
        setRotation(diff);
      };
      const onUp = () => {
        if (rotateState.current) {
          const releaseAngle = rotateState.current.lastAngle;
          // Estimate angular velocity from the current angle (bigger angle = more energy)
          const angularVelocity = releaseAngle * 0.15;
          rotateState.current = null;
          // Start physics simulation from release point
          startPhysicsSwing(releaseAngle, angularVelocity);
        }
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [note.isEditing, startPhysicsSwing]
  );
  // --- Resize logic ---
  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      if (note.isEditing) return;
      e.stopPropagation();
      e.preventDefault();
      resizeState.current = {
        startMouseX: e.clientX,
        startWidth: note.width,
      };
      const onMove = (me: PointerEvent) => {
        if (!resizeState.current) return;
        const dx = me.clientX - resizeState.current.startMouseX;
        const newWidth = Math.max(180, Math.min(600, resizeState.current.startWidth + dx));
        onUpdate(note.id, { width: newWidth });
      };
      const onUp = () => {
        resizeState.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [note.isEditing, note.id, note.width, onUpdate]
  );

  // Corner handle positions
  const corners = [
  {
    className: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2'
  },
  {
    className: 'top-0 right-0 translate-x-1/2 -translate-y-1/2'
  },
  {
    className: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2'
  },
  {
    className: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2'
  }];

  // When hand/pencil cursor is active, block most interactions
  const isCursorActive = cursorMode === 'hand' || cursorMode === 'pencil';

  return (
    <div
      ref={wrapperRef}
      className="absolute select-none"
      style={{
        left: note.x,
        top: note.y,
        zIndex: isDragging ? 200 : note.isEditing ? 100 : 10,
        transformOrigin: 'top center',
        transform: `rotate(${rotation}deg)`,
        pointerEvents: isCursorActive ? 'none' : 'auto',
      }}
      onPointerDown={(e) => e.stopPropagation()}>

      {/* Thumb tack — only when locked, draggable for admins */}
      {!note.isEditing &&
      <div
        className="absolute -top-5 left-1/2 -translate-x-1/2 z-20"
        style={{
          cursor: readOnly ? 'default' : isDragging ? 'grabbing' : 'grab'
        }}
        onPointerDown={readOnly ? undefined : onTackPointerDown}>

          <img
          src={TACK_IMG}
          alt="Pin"
          className="w-10 h-10 drop-shadow-md"
          draggable={false} />

        </div>
      }

      {/* Note body */}
      <div
        className={`relative rounded-sm ${note.isEditing ? '' : 'sticky-wrapper'}`}
        style={{
          backgroundColor: note.color,
          width: note.width,
        }}>

        {/* Subtle paper texture overlay */}
        <div
          className="absolute inset-0 rounded-sm pointer-events-none opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
          }} />


        <div
          className={`relative z-10 flex flex-col ${note.isEditing ? '' : 'sticky-note-shadow'}`}
          style={{ padding: Math.round(note.width * 0.05), gap: Math.round(note.width * 0.04) }}>

          {/* === EDIT MODE === */}
          {note.isEditing ?
          <>
              <div>
                <input
                  type="text"
                  placeholder="Title..."
                  value={note.topText}
                  onChange={(e) => onUpdate(note.id, { topText: e.target.value })}
                  className="w-full bg-transparent border-none outline-none font-handwriting text-stone-800 placeholder:text-stone-400/60"
                  style={{ fontSize: Math.round(note.width * 0.075), fontWeight: note.topBold ? 700 : 400, fontStyle: note.topItalic ? 'italic' : 'normal', textAlign: note.topCenter ? 'center' : 'left' }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                  {([
                    { key: 'topBold', active: note.topBold, icon: <BoldIcon style={{ width: 12, height: 12 }} />, title: 'Bold' },
                    { key: 'topItalic', active: note.topItalic, icon: <ItalicIcon style={{ width: 12, height: 12 }} />, title: 'Italic' },
                    { key: 'topCenter', active: note.topCenter, icon: <AlignCenterIcon style={{ width: 12, height: 12 }} />, title: 'Center' },
                  ] as const).map((btn) => (
                    <button
                      key={btn.key}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onUpdate(note.id, { [btn.key]: !btn.active }); }}
                      style={{
                        width: 22, height: 22, borderRadius: 4, border: 'none',
                        background: btn.active ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.05)',
                        color: '#44403c', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'background 0.1s',
                      }}
                      title={btn.title}
                    >
                      {btn.icon}
                    </button>
                  ))}
                </div>
              </div>

              <div
              onClick={handleImageClick}
              className="relative w-full rounded border-2 border-dashed border-stone-400/40 flex items-center justify-center cursor-pointer hover:border-stone-500/60 transition-colors overflow-hidden"
              style={{ minHeight: note.imageUrl ? undefined : Math.round(note.width * 0.3) }}>

                {isUploadingMedia ? (
                  <div className="flex flex-col items-center gap-1 text-stone-400/70" style={{ padding: 16 }}>
                    <LoaderIcon className="w-7 h-7 animate-spin" />
                    <span className="text-xs font-handwriting">Uploading...</span>
                  </div>
                ) : note.imageUrl ? (
                  note.mediaType === 'video' ? (
                    <video
                      src={note.imageUrl}
                      className="w-full rounded"
                      style={{ display: 'block', maxHeight: 400 }}
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={note.imageUrl}
                      alt="Upload"
                      className="w-full rounded"
                      style={{ display: 'block' }}
                      draggable={false}
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center gap-1 text-stone-400/70" style={{ padding: 16 }}>
                    <ImagePlusIcon className="w-7 h-7" />
                    <span className="text-xs font-handwriting">Add image / video / gif</span>
                  </div>
                )}
                <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/webm,video/quicktime"
                onChange={handleFileChange}
                className="hidden" />

              </div>
              <div>
                <textarea
                  placeholder="Description..."
                  value={note.bottomText}
                  onChange={(e) => onUpdate(note.id, { bottomText: e.target.value })}
                  rows={2}
                  className="w-full bg-transparent border-none outline-none font-handwriting text-stone-700 placeholder:text-stone-400/60 resize-none"
                  style={{ fontSize: Math.round(note.width * 0.055), fontWeight: note.bottomBold ? 700 : 400, fontStyle: note.bottomItalic ? 'italic' : 'normal', textAlign: note.bottomCenter ? 'center' : 'left' }}
                />
                <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                  {([
                    { key: 'bottomBold', active: note.bottomBold, icon: <BoldIcon style={{ width: 12, height: 12 }} />, title: 'Bold' },
                    { key: 'bottomItalic', active: note.bottomItalic, icon: <ItalicIcon style={{ width: 12, height: 12 }} />, title: 'Italic' },
                    { key: 'bottomCenter', active: note.bottomCenter, icon: <AlignCenterIcon style={{ width: 12, height: 12 }} />, title: 'Center' },
                  ] as const).map((btn) => (
                    <button
                      key={btn.key}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onUpdate(note.id, { [btn.key]: !btn.active }); }}
                      style={{
                        width: 22, height: 22, borderRadius: 4, border: 'none',
                        background: btn.active ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.05)',
                        color: '#44403c', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'background 0.1s',
                      }}
                      title={btn.title}
                    >
                      {btn.icon}
                    </button>
                  ))}
                </div>
              </div>

              <button
              onClick={(e) => {
                e.stopPropagation();
                onLock(note.id);
              }}
              className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-stone-700/80 text-white flex items-center justify-center hover:bg-stone-800 transition-colors shadow-sm"
              title="Done">

                <CheckIcon className="w-4 h-4" />
              </button>
            </> :

          <>
              {note.topText &&
            <p className="font-handwriting text-stone-800 leading-snug break-words"
              style={{ fontSize: Math.round(note.width * 0.075), fontWeight: note.topBold ? 700 : 400, fontStyle: note.topItalic ? 'italic' : 'normal', textAlign: note.topCenter ? 'center' : 'left' }}>
                  {note.topText}
                </p>
            }
              {note.imageUrl &&
            <div className="w-full rounded overflow-hidden">
                  {note.mediaType === 'video' ? (
                    <video
                      src={note.imageUrl}
                      className="w-full rounded"
                      style={{ display: 'block', maxHeight: 500 }}
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={note.imageUrl}
                      alt={note.topText || 'Note image'}
                      className="w-full rounded"
                      style={{ display: 'block' }}
                      draggable={false}
                    />
                  )}
                </div>
            }
              {note.bottomText &&
            <p className="font-handwriting text-stone-700 leading-snug break-words"
              style={{ fontSize: Math.round(note.width * 0.055), fontWeight: note.bottomBold ? 700 : 400, fontStyle: note.bottomItalic ? 'italic' : 'normal', textAlign: note.bottomCenter ? 'center' : 'left' }}>
                  {note.bottomText}
                </p>
            }
              {!note.topText && !note.bottomText && !note.imageUrl &&
            <p className="font-handwriting text-base text-stone-400 italic">
                  Empty note
                </p>
            }
              {!readOnly && <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(note.id);
              }}
              className="delete-btn absolute -top-2 -right-2 w-6 h-6 rounded-full text-white flex items-center justify-center opacity-0 hover:bg-red-500 transition-all shadow-sm z-30"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.6)' }}
              title="Delete">

                <XIcon className="w-3 h-3" />
              </button>}
              {!readOnly && !devMode && corners.map((c, i) =>
            <div
              key={i}
              className={`corner-handle tilt-handle ${c.className}`}
              style={{
                pointerEvents: cursorMode === 'hand' ? 'auto' : undefined,
              }}
              onPointerDown={(e) => {
                // Override ALL cursors to hand-click for the entire tilt drag
                const s = document.getElementById('tilt-cursor-style');
                if (s) {
                  s.textContent = `* { cursor: url(/hand-click.png) 16 16, grabbing !important; }`;
                  // Re-append to ensure it comes after global cursor style
                  document.head.appendChild(s);
                }
                // Flag to prevent Navigation mouseup from restoring base cursor
                document.documentElement.dataset.tilting = '1';
                const restore = () => {
                  delete document.documentElement.dataset.tilting;
                  if (s) {
                    s.textContent = `div.tilt-handle, div.tilt-handle * { cursor: url(/hand-hover.png) 16 16, grab !important; }`;
                    // Re-append to keep it after global cursor style
                    document.head.appendChild(s);
                  }
                  window.removeEventListener('pointerup', restore);
                };
                window.addEventListener('pointerup', restore);
                onCornerDown(e);
              }} />

            )}
              {/* Resize handle — hidden when hand/pencil cursor active or readOnly */}
              {!readOnly && !isCursorActive && <div
                className="resize-handle"
                onPointerDown={onResizeDown}
                title="Resize"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" style={{ opacity: 0.5 }}>
                  <line x1="4" y1="14" x2="14" y2="4" stroke="#44403c" strokeWidth="1.5" />
                  <line x1="8" y1="14" x2="14" y2="8" stroke="#44403c" strokeWidth="1.5" />
                  <line x1="12" y1="14" x2="14" y2="12" stroke="#44403c" strokeWidth="1.5" />
                </svg>
              </div>}
            </>
          }
        </div>
      </div>
      {/* Hidden span to measure title width for auto-expand */}
      <span
        ref={titleMeasureRef}
        className="font-handwriting"
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          fontSize: Math.round(note.width * 0.075),
          fontWeight: note.topBold ? 700 : 400,
          fontStyle: note.topItalic ? 'italic' : 'normal',
          pointerEvents: 'none',
        }}
      >
        {note.topText}
      </span>
    </div>);

}
