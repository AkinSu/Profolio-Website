"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { IntroAnimation } from "@/components/IntroAnimation";
import { DevButton, CanvasMode } from "@/components/DevButton";
import { StickyNote } from "@/components/StickyNote";
import { StickyNoteData, MediaType } from "@/hooks/useStickyNotes";
import { CanvasText } from "@/components/CanvasText";
import { CanvasTextData } from "@/hooks/useCanvasTexts";
import { CanvasImage } from "@/components/CanvasImage";
import { CanvasImageData } from "@/hooks/useCanvasImages";
import { CanvasTextButton } from "@/components/CanvasTextButton";
import { CanvasImageButton } from "@/components/CanvasImageButton";
import { CanvasTextButtonData, CanvasImageButtonData } from "@/hooks/useCanvasButtons";
import { PencilCanvas, PencilStroke, CANVAS_Y_OFFSET } from "@/components/PencilCanvas";
import { DrawingElement, DrawingElementData } from "@/components/DrawingElement";
import { useCanvasElements, CanvasElement } from "@/hooks/useCanvasElements";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AdminLogin } from "@/components/AdminLogin";
import { uploadFiles } from "@/lib/uploadthing";
import { compressStroke } from "@/lib/strokeCompression";

const NOTE_COLORS = ['#FFF176', '#F48FB1', '#90CAF9', '#A5D6A7', '#FFCC80', '#CE93D8'];
function randomNoteColor() { return NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)]; }

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;
const CANVAS_RIGHT = 4000;

// Visitor drawing persist zone (the big rectangle in the bottom-right)
const PERSIST_ZONE = { x1: 1470, y1: 1394, x2: 4003, y2: 3010 };

export default function HomeContent() {
  const { isAdmin, isAdminResolved, showLogin, setShowLogin, login } = useIsAdmin();
  const [overlayDone, setOverlayDone] = useState(false);
  const [mode, setMode] = useState<CanvasMode>('pan');
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  const [activeCursor, setActiveCursor] = useState<string | null>(null);
  const pencilActiveRef = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);

  // ─── Admin login shortcut (Ctrl/Cmd + Shift + L) ───
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        if (!isAdmin) setShowLogin(true);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isAdmin, setShowLogin]);

  // ─── Single source of truth ───
  const {
    elements, isLoading,
    addElement, persistElement, updateElement, removeElement,
  } = useCanvasElements(isAdmin);

  const handleStrokeComplete = useCallback((stroke: PencilStroke) => {
    const drawingData = compressStroke(stroke.points, CANVAS_Y_OFFSET);
    if (!drawingData) return;

    // Check if stroke center is inside the persist zone
    const cx = drawingData.x + drawingData.width / 2;
    const cy = drawingData.y + drawingData.height / 2;
    const inZone = cx >= PERSIST_ZONE.x1 && cx <= PERSIST_ZONE.x2
                && cy >= PERSIST_ZONE.y1 && cy <= PERSIST_ZONE.y2;

    // Admin drawings always persist; visitor drawings only persist in the zone
    const shouldPersist = isAdmin || inZone;
    console.log(`[stroke] admin=${isAdmin} center=(${cx.toFixed(0)},${cy.toFixed(0)}) inZone=${inZone} persist=${shouldPersist}`);

    const id = crypto.randomUUID();
    addElement({
      id,
      type: 'drawing',
      z_index: 3,
      data: drawingData as unknown as Record<string, unknown>,
    }, shouldPersist);
  }, [addElement, isAdmin]);

  // Keep a ref for reading current elements in callbacks
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  // ─── Derived typed arrays via useMemo ───
  const notes = useMemo<StickyNoteData[]>(() =>
    elements
      .filter((e) => e.type === 'sticky_note')
      .map((e) => ({ ...e.data, id: e.id } as StickyNoteData)),
    [elements]
  );

  const texts = useMemo<CanvasTextData[]>(() =>
    elements
      .filter((e) => e.type === 'text')
      .map((e) => ({ ...e.data, id: e.id } as CanvasTextData)),
    [elements]
  );

  const images = useMemo<CanvasImageData[]>(() =>
    elements
      .filter((e) => e.type === 'image')
      .map((e) => ({ ...e.data, id: e.id } as CanvasImageData)),
    [elements]
  );

  const textButtons = useMemo<CanvasTextButtonData[]>(() =>
    elements
      .filter((e) => e.type === 'text_button')
      .map((e) => ({ ...e.data, id: e.id } as CanvasTextButtonData)),
    [elements]
  );

  const imageButtons = useMemo<CanvasImageButtonData[]>(() =>
    elements
      .filter((e) => e.type === 'image_button')
      .map((e) => ({ ...e.data, id: e.id } as CanvasImageButtonData)),
    [elements]
  );

  const drawings = useMemo<DrawingElementData[]>(() =>
    elements
      .filter((e) => e.type === 'drawing')
      .map((e) => ({ ...e.data, id: e.id } as unknown as DrawingElementData)),
    [elements]
  );

  // ─── Add handlers ───

  const handleAddNote = useCallback((x: number, y: number) => {
    const id = crypto.randomUUID();
    addElement({
      id, type: 'sticky_note', z_index: 10,
      data: {
        x, y, width: 320, color: randomNoteColor(),
        topText: '', topBold: false, topItalic: false, topCenter: false,
        bottomText: '', bottomBold: false, bottomItalic: false, bottomCenter: false,
        imageUrl: null, mediaType: null, isEditing: true,
      },
    });
    return id;
  }, [addElement]);

  const handleAddText = useCallback((x: number, y: number) => {
    const id = crypto.randomUUID();
    addElement({
      id, type: 'text', z_index: 5,
      data: {
        x, y, text: '', color: '#292524', fontSize: 28,
        bold: false, rotation: 0, isEditing: true,
      },
    });
    return id;
  }, [addElement]);

  const handleAddTextButton = useCallback((x: number, y: number) => {
    const id = crypto.randomUUID();
    addElement({
      id, type: 'text_button', z_index: 5,
      data: {
        x, y, text: '', href: '', color: '#292524', fontSize: 28,
        bold: false, rotation: 0, isEditing: true,
      },
    });
    return id;
  }, [addElement]);

  const handleImageUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const [uploaded] = await uploadFiles("canvasImage", { files: [file] });
      console.log('UploadThing response:', JSON.stringify(uploaded, null, 2));
      const url = uploaded.url ?? uploaded.ufsUrl ?? (uploaded.serverData as Record<string, unknown>)?.url;
      if (!url) { console.error('No URL in upload response:', uploaded); setIsUploading(false); return; }
      // Load the image to get natural dimensions
      const img = new Image();
      img.onload = () => {
        const cx = (-offsetX.get() + window.innerWidth / 2) / zoomRef.current;
        const cy = (-offsetY.get() + window.innerHeight / 2) / zoomRef.current;
        const displayWidth = 300;
        const displayHeight = (img.naturalHeight / img.naturalWidth) * displayWidth;
        const id = crypto.randomUUID();
        addElement({
          id, type: 'image', z_index: 8,
          data: {
            x: cx - displayWidth / 2, y: cy - displayHeight / 2,
            width: displayWidth, height: displayHeight, rotation: 0,
            src: url, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
          },
        }, true);
        setIsUploading(false);
      };
      img.onerror = () => setIsUploading(false);
      img.src = url;
    } catch (err) {
      console.error('Image upload failed:', err);
      setIsUploading(false);
    }
  }, [addElement]);

  const handleImageButtonUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const [uploaded] = await uploadFiles("canvasImage", { files: [file] });
      console.log('UploadThing response:', JSON.stringify(uploaded, null, 2));
      const url = uploaded.url ?? uploaded.ufsUrl ?? (uploaded.serverData as Record<string, unknown>)?.url;
      if (!url) { console.error('No URL in upload response:', uploaded); setIsUploading(false); return; }
      const img = new Image();
      img.onload = () => {
        const cx = (-offsetX.get() + window.innerWidth / 2) / zoomRef.current;
        const cy = (-offsetY.get() + window.innerHeight / 2) / zoomRef.current;
        const displayWidth = 200;
        const displayHeight = (img.naturalHeight / img.naturalWidth) * displayWidth;
        const id = crypto.randomUUID();
        addElement({
          id, type: 'image_button', z_index: 8,
          data: {
            x: cx - displayWidth / 2, y: cy - displayHeight / 2,
            width: displayWidth, height: displayHeight,
            src: url, href: '', naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
            isEditing: true,
          },
        });
        setIsUploading(false);
      };
      img.onerror = () => setIsUploading(false);
      img.src = url;
    } catch (err) {
      console.error('Image button upload failed:', err);
      setIsUploading(false);
    }
  }, [addElement]);

  // ─── Update handlers (pass-through to updateElement) ───

  const handleUpdateNote = useCallback((id: string, updates: Partial<StickyNoteData>) => {
    updateElement(id, updates as Record<string, unknown>);
  }, [updateElement]);

  const handleUpdateText = useCallback((id: string, updates: Partial<CanvasTextData>) => {
    updateElement(id, updates as Record<string, unknown>);
  }, [updateElement]);

  const handleUpdateImage = useCallback((id: string, updates: Partial<CanvasImageData>) => {
    updateElement(id, updates as Record<string, unknown>);
  }, [updateElement]);

  const handleUpdateTextButton = useCallback((id: string, updates: Partial<CanvasTextButtonData>) => {
    updateElement(id, updates as Record<string, unknown>);
  }, [updateElement]);

  const handleUpdateImageButton = useCallback((id: string, updates: Partial<CanvasImageButtonData>) => {
    updateElement(id, updates as Record<string, unknown>);
  }, [updateElement]);

  const handleUpdateDrawing = useCallback((id: string, updates: Partial<DrawingElementData>) => {
    updateElement(id, updates as Record<string, unknown>);
  }, [updateElement]);

  // ─── Lock handlers (isEditing → false, then persist) ───

  const handleLockNote = useCallback((id: string) => {
    updateElement(id, { isEditing: false });
    persistElement(id);
  }, [updateElement, persistElement]);

  const handleLockText = useCallback((id: string) => {
    const el = elementsRef.current.find((e) => e.id === id);
    if (el && !(el.data.text as string)?.trim()) {
      removeElement(id);
      return;
    }
    updateElement(id, { isEditing: false });
    persistElement(id);
  }, [updateElement, persistElement, removeElement]);

  const handleLockTextButton = useCallback((id: string) => {
    const el = elementsRef.current.find((e) => e.id === id);
    if (el && !(el.data.text as string)?.trim()) {
      removeElement(id);
      return;
    }
    updateElement(id, { isEditing: false });
    persistElement(id);
  }, [updateElement, persistElement, removeElement]);

  const handleLockImageButton = useCallback((id: string) => {
    updateElement(id, { isEditing: false });
    persistElement(id);
  }, [updateElement, persistElement]);

  // ─── Delete handlers ───

  const handleDeleteNote = useCallback((id: string) => { removeElement(id); }, [removeElement]);
  const handleDeleteText = useCallback((id: string) => { removeElement(id); }, [removeElement]);
  const handleDeleteImage = useCallback((id: string) => { removeElement(id); }, [removeElement]);
  const handleDeleteTextButton = useCallback((id: string) => { removeElement(id); }, [removeElement]);
  const handleDeleteImageButton = useCallback((id: string) => { removeElement(id); }, [removeElement]);
  const handleDeleteDrawing = useCallback((id: string) => { removeElement(id); }, [removeElement]);

  const handleClearDrawings = useCallback(() => {
    const drawingIds = elementsRef.current
      .filter((e) => e.type === 'drawing')
      .map((e) => e.id);
    for (const id of drawingIds) {
      removeElement(id);
    }
  }, [removeElement]);

  // ─── Linkable elements list for button linking ───

  const linkableElements = useMemo(() =>
    elements
      .filter(e => ['sticky_note', 'text', 'image', 'text_button', 'image_button'].includes(e.type))
      .map(e => {
        let label = e.type.replace('_', ' ');
        const text = e.data.text as string | undefined;
        const topText = e.data.topText as string | undefined;
        if (text) label = text.length > 25 ? text.slice(0, 25) + '...' : text;
        else if (topText) label = topText.length > 25 ? topText.slice(0, 25) + '...' : topText;
        else if (e.type === 'image') label = 'Image';
        else if (e.type === 'image_button') label = 'Image Button';
        else if (e.type === 'sticky_note') label = 'Sticky Note';
        return { id: e.id, type: e.type, label };
      }),
    [elements]
  );

  // ─── Canvas panning & zoom ───

  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);

  const isPanningRef = useRef(false);
  const didPanRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const outerRef = useRef<HTMLDivElement>(null);
  const rulesRef = useRef<HTMLDivElement>(null);
  const [panLimitPos, setPanLimitPos] = useState<{ x: number; y: number } | null>(null);

  const clampX = useCallback((ox: number, z: number) => {
    const maxX = 0;
    const minX = window.innerWidth - CANVAS_RIGHT * z;
    if (minX >= maxX) return 0; // canvas fits in viewport, pin to left
    return Math.max(minX, Math.min(maxX, ox));
  }, []);

  const clampY = useCallback((oy: number, z: number) => {
    const maxY = 2000 * z;
    const minY = window.innerHeight - 3000 * z;
    return Math.max(minY, Math.min(maxY, oy));
  }, []);

  const updateRuledLines = useCallback((z: number, oy: number) => {
    if (!rulesRef.current) return;
    const spacing = 32 * z;
    rulesRef.current.style.backgroundSize = `100% ${spacing}px`;
    rulesRef.current.style.backgroundImage =
      `repeating-linear-gradient(transparent, transparent ${spacing - 1}px, rgba(140,180,220,0.25) ${spacing - 1}px, rgba(140,180,220,0.25) ${spacing}px)`;
    rulesRef.current.style.backgroundPosition = `0 ${48 * z + oy}px`;
  }, []);

  const disableCursors = devMenuOpen || mode === 'place' || mode === 'text' || mode === 'textbtn' || mode === 'imgbtn';

  const handleCursorChange = useCallback((cursor: string | null) => {
    pencilActiveRef.current = cursor === "pencil";
    setActiveCursor(cursor);
  }, []);

  const getCursor = useCallback(() => {
    if (drawMode) return 'crosshair';
    if (mode === 'place' || mode === 'text' || mode === 'textbtn') return 'crosshair';
    return 'grab';
  }, [mode, drawMode]);

  useEffect(() => {
    const stop = () => {
      isPanningRef.current = false;
      if (outerRef.current) outerRef.current.style.cursor = getCursor();
    };
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, [getCursor]);

  // ─── Prevent text selection when dragging from buttons ───
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener('selectstart', prevent);
    el.addEventListener('dragstart', prevent);
    return () => { el.removeEventListener('selectstart', prevent); el.removeEventListener('dragstart', prevent); };
  }, []);

  // ─── Wheel: Ctrl+scroll = zoom, plain scroll = vertical pan ───
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Zoom toward cursor — proportional to delta for organic feel
        // Don't let zoom out past the point where canvas fills viewport width
        const minZoom = Math.max(MIN_ZOOM, window.innerWidth / CANVAS_RIGHT);
        const zoomFactor = 1 - e.deltaY * 0.01;
        const newZoom = Math.min(MAX_ZOOM, Math.max(minZoom, zoomRef.current * zoomFactor));
        if (newZoom === zoomRef.current) return;

        const worldX = (e.clientX - offsetX.get()) / zoomRef.current;
        const worldY = (e.clientY - offsetY.get()) / zoomRef.current;

        const newOX = clampX(e.clientX - worldX * newZoom, newZoom);
        const newOY = clampY(e.clientY - worldY * newZoom, newZoom);

        offsetX.set(newOX);
        offsetY.set(newOY);
        zoomRef.current = newZoom;
        setZoom(newZoom);
        updateRuledLines(newZoom, newOY);
      } else {
        // Scroll — horizontal + vertical
        const rawX = offsetX.get() - e.deltaX;
        const rawY = offsetY.get() - e.deltaY;
        offsetX.set(clampX(rawX, zoomRef.current));
        const clampedY = clampY(rawY, zoomRef.current);
        offsetY.set(clampedY);
        updateRuledLines(zoomRef.current, clampedY);
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [offsetX, offsetY, clampX, clampY, updateRuledLines]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    if (mode === 'place' || mode === 'text' || mode === 'textbtn' || mode === 'imgbtn') return;
    if (pencilActiveRef.current || drawMode) return;
    e.preventDefault();
    isPanningRef.current = true;
    didPanRef.current = false;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    if (outerRef.current) outerRef.current.style.cursor = "grabbing";
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didPanRef.current = true;

    const z = zoomRef.current;
    const rawX = offsetX.get() + dx;
    const rawY = offsetY.get() + dy;
    const clampedX = clampX(rawX, z);
    const clampedY = clampY(rawY, z);
    offsetX.set(clampedX);
    offsetY.set(clampedY);

    if (rawX !== clampedX || rawY !== clampedY) {
      setPanLimitPos({ x: e.clientX, y: e.clientY });
    } else {
      setPanLimitPos(null);
    }

    updateRuledLines(z, clampedY);
  };

  const handlePointerUp = () => {
    isPanningRef.current = false;
    setPanLimitPos(null);
    if (outerRef.current) outerRef.current.style.cursor = getCursor();
  };

  // ─── Pan to element (for internal canvas linking) ───

  const panToElement = useCallback((elementId: string) => {
    const el = elementsRef.current.find((e) => e.id === elementId);
    if (!el) return;

    // Reset zoom to default (1) when navigating to an element
    const z = 1;
    zoomRef.current = z;
    setZoom(z);

    const x = Number(el.data.x) || 0;
    const y = Number(el.data.y) || 0;
    const w = Number(el.data.width) || 200;
    const h = Number(el.data.height) || 100;

    const targetX = clampX(-(x + w / 2) * z + window.innerWidth / 2, z);
    const targetY = clampY(-(y + h / 2) * z + window.innerHeight / 2, z);

    animate(offsetX.get(), targetX, {
      duration: 0.6,
      ease: "easeInOut",
      onUpdate: (v) => offsetX.set(v),
    });
    animate(offsetY.get(), targetY, {
      duration: 0.6,
      ease: "easeInOut",
      onUpdate: (v) => {
        offsetY.set(v);
        updateRuledLines(z, v);
      },
    });
  }, [offsetX, offsetY, clampX, clampY, updateRuledLines]);

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, textarea")) return;
    const z = zoomRef.current;
    if (mode === 'place') {
      if (notes.some((n) => n.isEditing)) return;
      const x = (e.clientX - offsetX.get()) / z - 160;
      const y = (e.clientY - offsetY.get()) / z - 20;
      handleAddNote(x, y);
    } else if (mode === 'text') {
      if (texts.some((t) => t.isEditing)) return;
      const x = (e.clientX - offsetX.get()) / z;
      const y = (e.clientY - offsetY.get()) / z;
      handleAddText(x, y);
    } else if (mode === 'textbtn') {
      if (textButtons.some((b) => b.isEditing)) return;
      const x = (e.clientX - offsetX.get()) / z;
      const y = (e.clientY - offsetY.get()) / z;
      handleAddTextButton(x, y);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode('pan');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  console.log("[HomeContent] about to render, overlayDone:", overlayDone);

  return (
    <>
      {showLogin && !isAdmin && (
        <AdminLogin
          onLogin={login}
          onClose={() => setShowLogin(false)}
        />
      )}

      <IntroAnimation onComplete={() => setOverlayDone(true)} />

      {/* Loading indicator */}
      {isLoading && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'rgba(26,26,26,0.85)',
            color: 'rgba(255,255,255,0.7)',
            padding: '6px 16px',
            borderRadius: 8,
            fontSize: 12,
            fontFamily: 'monospace',
            pointerEvents: 'none',
          }}
        >
          loading canvas...
        </div>
      )}

      {isUploading && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'rgba(26,26,26,0.85)',
            color: 'rgba(255,255,255,0.7)',
            padding: '6px 16px',
            borderRadius: 8,
            fontSize: 12,
            fontFamily: 'monospace',
            pointerEvents: 'none',
          }}
        >
          uploading image...
        </div>
      )}

      <div
        id="canvas-root"
        ref={outerRef}
        style={{
          height: "100vh",
          position: "relative",
          overflow: "hidden",
          userSelect: "none",
          touchAction: "none",
          cursor: getCursor(),
          backgroundColor: "#f5f5f0",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleClick}
      >

        {/* Pan limit indicator */}
        {panLimitPos && (
          <div
            style={{
              position: 'fixed',
              left: panLimitPos.x + 20,
              top: panLimitPos.y - 24,
              zIndex: 99999,
              pointerEvents: 'none',
              userSelect: 'none',
              fontSize: 22,
              fontWeight: 900,
              color: '#dc2626',
              textShadow: '0 1px 4px rgba(0,0,0,0.15)',
              fontFamily: 'sans-serif',
              lineHeight: 1,
            }}
          >
            !
          </div>
        )}

        <Navigation
          onCursorChange={handleCursorChange}
          disableCursors={disableCursors}
          show={overlayDone}
        />
        {isAdmin && (
          <DevButton mode={mode} onModeChange={setMode} onOpenChange={setDevMenuOpen} onImageUpload={handleImageUpload} onImageButtonUpload={handleImageButtonUpload} drawMode={drawMode} onDrawModeChange={setDrawMode} onClearDrawings={handleClearDrawings} />
        )}

        {/* Layer 1: Blue ruled lines */}
        <div
          ref={rulesRef}
          style={{
            position: "absolute",
            top: -3000,
            bottom: -3000,
            left: 0,
            right: 0,
            pointerEvents: "none",
            backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, rgba(140,180,220,0.25) 31px, rgba(140,180,220,0.25) 32px)",
            backgroundSize: "100% 32px",
            backgroundPosition: "0 48px",
            zIndex: 0,
          }}
        />

        {/* Layer 2+3: Pan layer */}
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            x: offsetX,
            y: offsetY,
            scale: zoom,
            transformOrigin: "0 0",
          }}
        >
          {/* Red margin line */}
          <div
            style={{
              position: "absolute",
              top: -2000,
              left: 240,
              width: 5,
              height: 5000,
              backgroundColor: "rgba(220,80,80,0.3)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />

          {/* Top margin */}
          <div
            style={{
              position: "absolute",
              top: -2000,
              left: 0,
              width: 99999,
              height: 224,
              backgroundColor: "#f5f5f0",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />

          {/* Persisted drawings */}
          {drawings.map((d) => (
            <DrawingElement
              key={d.id}
              data={d}
              onUpdate={handleUpdateDrawing}
              onDelete={handleDeleteDrawing}
              disabled={!!activeCursor || drawMode}
              readOnly={!isAdmin}
              zoom={zoom}
            />
          ))}

          {/* Live pencil input */}
          <PencilCanvas
            offsetX={offsetX}
            offsetY={offsetY}
            isActive={activeCursor === 'pencil' || drawMode}
            isAdmin={isAdmin}
            devDrawMode={drawMode}
            onStrokeComplete={handleStrokeComplete}
            zoom={zoom}
          />

          {/* Canvas images */}
          {images.map((img) => (
            <CanvasImage
              key={img.id}
              data={img}
              onUpdate={handleUpdateImage}
              onDelete={handleDeleteImage}
              disabled={!!activeCursor}
              readOnly={!isAdmin}
              zoom={zoom}
            />
          ))}

          {/* Canvas texts */}
          <div style={{ color: '#292524' }}>
            {texts.map((t) => (
              <CanvasText
                key={t.id}
                data={t}
                onUpdate={handleUpdateText}
                onLock={handleLockText}
                onDelete={handleDeleteText}
                disabled={!!activeCursor}
                readOnly={!isAdmin}
                zoom={zoom}
              />
            ))}
          </div>

          {/* Canvas text buttons */}
          <div style={{ color: '#292524' }}>
            {textButtons.map((b) => (
              <CanvasTextButton
                key={b.id}
                data={b}
                onUpdate={handleUpdateTextButton}
                onLock={handleLockTextButton}
                onDelete={handleDeleteTextButton}
                disabled={activeCursor === 'pencil'}
                devMode={devMenuOpen}
                readOnly={!isAdmin}
                linkableElements={linkableElements}
                onPanToElement={panToElement}
                zoom={zoom}
              />
            ))}
          </div>

          {/* Canvas image buttons */}
          {imageButtons.map((b) => (
            <CanvasImageButton
              key={b.id}
              data={b}
              onUpdate={handleUpdateImageButton}
              onLock={handleLockImageButton}
              onDelete={handleDeleteImageButton}
              disabled={activeCursor === 'pencil'}
              devMode={devMenuOpen}
              cursorMode={activeCursor}
              readOnly={!isAdmin}
              linkableElements={linkableElements}
              onPanToElement={panToElement}
              zoom={zoom}
            />
          ))}

          {/* Sticky notes */}
          <div style={{ color: '#292524' }}>
            {notes.map((note) => (
              <StickyNote
                key={note.id}
                note={note}
                onUpdate={handleUpdateNote}
                onLock={handleLockNote}
                onDelete={handleDeleteNote}
                cursorMode={activeCursor}
                devMode={devMenuOpen}
                readOnly={!isAdmin}
                zoom={zoom}
              />
            ))}
          </div>
        </motion.div>

        {/* Zoom indicator */}
        {zoom !== 1 && (
          <div
            onClick={() => {
              // Reset zoom to 100%, re-center
              const oldZ = zoomRef.current;
              const cx = window.innerWidth / 2;
              const cy = window.innerHeight / 2;
              const worldX = (cx - offsetX.get()) / oldZ;
              const worldY = (cy - offsetY.get()) / oldZ;
              const newOX = clampX(cx - worldX, 1);
              const newOY = clampY(cy - worldY, 1);
              offsetX.set(newOX);
              offsetY.set(newOY);
              zoomRef.current = 1;
              setZoom(1);
              updateRuledLines(1, newOY);
            }}
            style={{
              position: 'fixed',
              bottom: 20,
              left: 20,
              zIndex: 9999,
              background: 'rgba(45,42,38,0.75)',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "'Caveat', cursive",
              fontWeight: 700,
              cursor: 'pointer',
              userSelect: 'none',
              pointerEvents: 'auto',
            }}
            title="Click to reset to 100%"
          >
            {Math.round(zoom * 100)}%
          </div>
        )}
      </div>
    </>
  );
}
