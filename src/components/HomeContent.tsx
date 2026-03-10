"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, useMotionValue } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { IntroAnimation } from "@/components/IntroAnimation";
import { DevButton, CanvasMode } from "@/components/DevButton";
import { StickyNote } from "@/components/StickyNote";
import { useStickyNotes, StickyNoteData } from "@/hooks/useStickyNotes";
import { CanvasText } from "@/components/CanvasText";
import { useCanvasTexts, CanvasTextData } from "@/hooks/useCanvasTexts";
import { CanvasImage } from "@/components/CanvasImage";
import { useCanvasImages, CanvasImageData } from "@/hooks/useCanvasImages";
import { CanvasTextButton } from "@/components/CanvasTextButton";
import { CanvasImageButton } from "@/components/CanvasImageButton";
import { useCanvasButtons, CanvasTextButtonData, CanvasImageButtonData } from "@/hooks/useCanvasButtons";
import { useCanvasElements } from "@/hooks/useCanvasElements";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export default function HomeContent() {
  const { isAdmin, isAdminResolved } = useIsAdmin();
  const [overlayDone, setOverlayDone] = useState(false);
  const [mode, setMode] = useState<CanvasMode>('pan');
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  const [activeCursor, setActiveCursor] = useState<string | null>(null);
  const pencilActiveRef = useRef(false);

  const { notes, setNotes, addNote, updateNote, lockNote, deleteNote } = useStickyNotes();
  const { texts, setTexts, addText, updateText, lockText, deleteText } = useCanvasTexts();
  const { images, setImages, addImage, updateImage, deleteImage } = useCanvasImages();
  const {
    textButtons, setTextButtons, addTextButton, updateTextButton, lockTextButton, deleteTextButton,
    imageButtons, setImageButtons, addImageButton, updateImageButton, lockImageButton, deleteImageButton,
  } = useCanvasButtons();

  const {
    elements: dbElements,
    isLoading,
    addElement,
    updateElement,
    removeElement,
  } = useCanvasElements();

  // Prev refs for DB sync — declared here so hydration can pre-populate them
  const prevNotesRef = useRef<StickyNoteData[]>([]);
  const prevTextsRef = useRef<CanvasTextData[]>([]);
  const prevImagesRef = useRef<CanvasImageData[]>([]);
  const prevTextBtnsRef = useRef<CanvasTextButtonData[]>([]);
  const prevImgBtnsRef = useRef<CanvasImageButtonData[]>([]);

  // Hydrate local state from DB on initial load
  // Helper: parse dbElements into local state arrays
  const parseDbElements = useCallback((els: typeof dbElements) => {
    const loadedNotes: StickyNoteData[] = [];
    const loadedTexts: CanvasTextData[] = [];
    const loadedImages: CanvasImageData[] = [];
    const loadedTextButtons: CanvasTextButtonData[] = [];
    const loadedImageButtons: CanvasImageButtonData[] = [];

    // Coerce numeric fields that JSONB may return as strings
    function num(v: unknown, fallback: number): number {
      const n = Number(v);
      return isNaN(n) ? fallback : n;
    }

    for (const el of els) {
      const d = el.data as Record<string, unknown>;
      switch (el.type) {
        case 'sticky_note':
          loadedNotes.push({
            ...d, id: el.id, isEditing: false,
            x: num(d.x, 0), y: num(d.y, 0), width: num(d.width, 320),
          } as StickyNoteData);
          break;
        case 'text':
          loadedTexts.push({
            ...d, id: el.id, isEditing: false,
            x: num(d.x, 0), y: num(d.y, 0), fontSize: num(d.fontSize, 28), rotation: num(d.rotation, 0),
          } as CanvasTextData);
          break;
        case 'image':
          loadedImages.push({
            ...d, id: el.id,
            x: num(d.x, 0), y: num(d.y, 0), width: num(d.width, 300), height: num(d.height, 200),
            rotation: num(d.rotation, 0), naturalWidth: num(d.naturalWidth, 300), naturalHeight: num(d.naturalHeight, 200),
          } as CanvasImageData);
          break;
        case 'text_button':
          loadedTextButtons.push({
            ...d, id: el.id, isEditing: false,
            x: num(d.x, 0), y: num(d.y, 0), fontSize: num(d.fontSize, 28), rotation: num(d.rotation, 0),
          } as CanvasTextButtonData);
          break;
        case 'image_button':
          loadedImageButtons.push({
            ...d, id: el.id, isEditing: false,
            x: num(d.x, 0), y: num(d.y, 0), width: num(d.width, 200), height: num(d.height, 200),
            naturalWidth: num(d.naturalWidth, 200), naturalHeight: num(d.naturalHeight, 200),
          } as CanvasImageButtonData);
          break;
      }
    }
    return { loadedNotes, loadedTexts, loadedImages, loadedTextButtons, loadedImageButtons };
  }, []);

  // Initial hydration
  const hydrated = useRef(false);
  useEffect(() => {
    if (isLoading || !isAdminResolved || hydrated.current) return;
    hydrated.current = true;

    const { loadedNotes, loadedTexts, loadedImages, loadedTextButtons, loadedImageButtons } = parseDbElements(dbElements);

    if (loadedNotes.length) setNotes(loadedNotes);
    if (loadedTexts.length) setTexts(loadedTexts);
    if (loadedImages.length) setImages(loadedImages);
    if (loadedTextButtons.length) setTextButtons(loadedTextButtons);
    if (loadedImageButtons.length) setImageButtons(loadedImageButtons);

    // Pre-populate prev refs so sync effects don't treat hydrated data as new
    prevNotesRef.current = loadedNotes;
    prevTextsRef.current = loadedTexts;
    prevImagesRef.current = loadedImages;
    prevTextBtnsRef.current = loadedTextButtons;
    prevImgBtnsRef.current = loadedImageButtons;
  }, [isLoading, isAdminResolved, dbElements, setNotes, setTexts, setImages, setTextButtons, setImageButtons, parseDbElements]);

  // Live sync: for non-admin visitors, update local state whenever polled data changes
  // We track the last DB snapshot by serialized element map to avoid unnecessary updates
  const lastDbSnapshotRef = useRef('');
  useEffect(() => {
    if (!hydrated.current || isAdmin) return;

    // Build a lightweight fingerprint of the current DB elements
    const snapshot = dbElements.map((e) => `${e.id}:${e.updated_at}`).join('|');
    if (snapshot === lastDbSnapshotRef.current) return;
    lastDbSnapshotRef.current = snapshot;

    const { loadedNotes, loadedTexts, loadedImages, loadedTextButtons, loadedImageButtons } = parseDbElements(dbElements);

    setNotes(loadedNotes);
    setTexts(loadedTexts);
    setImages(loadedImages);
    setTextButtons(loadedTextButtons);
    setImageButtons(loadedImageButtons);
  }, [dbElements, isAdmin, setNotes, setTexts, setImages, setTextButtons, setImageButtons, parseDbElements]);

  // --- DB sync wrappers ---

  // Ref to track which IDs exist in DB — used by sync effects without causing re-runs
  const dbIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    dbIdsRef.current = new Set(dbElements.map((e) => e.id));
  }, [dbElements]);

  // Debounce refs for updates
  const updateTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const latestData = useRef<Map<string, Record<string, unknown>>>(new Map());

  useEffect(() => {
    return () => {
      updateTimers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const dbSyncUpdate = useCallback((id: string, type: string, fullData: Record<string, unknown>) => {
    latestData.current.set(id, fullData);
    const existing = updateTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      updateTimers.current.delete(id);
      const data = latestData.current.get(id);
      latestData.current.delete(id);
      if (data) {
        // Strip isEditing from persisted data
        const { isEditing, ...rest } = data as Record<string, unknown> & { isEditing?: boolean };
        updateElement(id, rest);
      }
    }, 500);
    updateTimers.current.set(id, timer);
  }, [updateElement]);

  // --- Wrapped handlers for sticky notes ---
  const handleAddNote = useCallback((x: number, y: number) => {
    const id = addNote(x, y);
    // We'll persist when locked (not while editing)
    return id;
  }, [addNote]);

  const handleUpdateNote = useCallback((id: string, updates: Partial<StickyNoteData>) => {
    updateNote(id, updates);
    // Find the full note to sync
    setTimeout(() => {
      // Use a microtask to get the updated state
    }, 0);
  }, [updateNote]);

  // Sync notes to DB when they change from editing to locked
  useEffect(() => {
    if (!hydrated.current || !isAdminResolved || !isAdmin) return;
    const prev = prevNotesRef.current;
    for (const note of notes) {
      const prevNote = prev.find((n) => n.id === note.id);
      if (!prevNote) {
        // New note — persist when locked
        if (!note.isEditing) {
          const { isEditing, ...data } = note;
          addElement({ id: note.id, type: 'sticky_note', data, z_index: 10 });
        }
      } else if (prevNote.isEditing && !note.isEditing) {
        // Just locked — persist
        const { isEditing, ...data } = note;
        // Check if this element exists in DB already
        if (dbIdsRef.current.has(note.id)) {
          const { isEditing: _, ...rest } = note;
          dbSyncUpdate(note.id, 'sticky_note', rest);
        } else {
          addElement({ id: note.id, type: 'sticky_note', data, z_index: 10 });
        }
      } else if (!note.isEditing && prevNote && !prevNote.isEditing) {
        // Already locked, data changed (e.g. drag, tilt) — debounced sync
        if (JSON.stringify(note) !== JSON.stringify(prevNote)) {
          const { isEditing, ...data } = note;
          dbSyncUpdate(note.id, 'sticky_note', data);
        }
      }
    }
    prevNotesRef.current = notes;
  }, [notes, addElement, dbSyncUpdate]);

  // Sync texts to DB
  useEffect(() => {
    if (!hydrated.current || !isAdminResolved || !isAdmin) return;
    const prev = prevTextsRef.current;
    for (const text of texts) {
      const prevText = prev.find((t) => t.id === text.id);
      if (!prevText) {
        if (!text.isEditing) {
          const { isEditing, ...data } = text;
          addElement({ id: text.id, type: 'text', data, z_index: 5 });
        }
      } else if (prevText.isEditing && !text.isEditing) {
        const { isEditing, ...data } = text;
        if (dbIdsRef.current.has(text.id)) {
          dbSyncUpdate(text.id, 'text', data);
        } else {
          addElement({ id: text.id, type: 'text', data, z_index: 5 });
        }
      } else if (!text.isEditing && !prevText.isEditing) {
        if (JSON.stringify(text) !== JSON.stringify(prevText)) {
          const { isEditing, ...data } = text;
          dbSyncUpdate(text.id, 'text', data);
        }
      }
    }
    prevTextsRef.current = texts;
  }, [texts, addElement, dbSyncUpdate]);

  // Sync images to DB
  useEffect(() => {
    if (!hydrated.current || !isAdminResolved || !isAdmin) return;
    const prev = prevImagesRef.current;
    for (const img of images) {
      const prevImg = prev.find((i) => i.id === img.id);
      if (!prevImg) {
        addElement({ id: img.id, type: 'image', data: { ...img }, z_index: 8 });
      } else if (JSON.stringify(img) !== JSON.stringify(prevImg)) {
        dbSyncUpdate(img.id, 'image', { ...img });
      }
    }
    prevImagesRef.current = images;
  }, [images, addElement, dbSyncUpdate]);

  // Sync text buttons to DB
  useEffect(() => {
    if (!hydrated.current || !isAdminResolved || !isAdmin) return;
    const prev = prevTextBtnsRef.current;
    for (const btn of textButtons) {
      const prevBtn = prev.find((b) => b.id === btn.id);
      if (!prevBtn) {
        if (!btn.isEditing) {
          const { isEditing, ...data } = btn;
          addElement({ id: btn.id, type: 'text_button', data, z_index: 5 });
        }
      } else if (prevBtn.isEditing && !btn.isEditing) {
        const { isEditing, ...data } = btn;
        if (dbIdsRef.current.has(btn.id)) {
          dbSyncUpdate(btn.id, 'text_button', data);
        } else {
          addElement({ id: btn.id, type: 'text_button', data, z_index: 5 });
        }
      } else if (!btn.isEditing && !prevBtn.isEditing) {
        if (JSON.stringify(btn) !== JSON.stringify(prevBtn)) {
          const { isEditing, ...data } = btn;
          dbSyncUpdate(btn.id, 'text_button', data);
        }
      }
    }
    prevTextBtnsRef.current = textButtons;
  }, [textButtons, addElement, dbSyncUpdate]);

  // Sync image buttons to DB
  useEffect(() => {
    if (!hydrated.current || !isAdminResolved || !isAdmin) return;
    const prev = prevImgBtnsRef.current;
    for (const btn of imageButtons) {
      const prevBtn = prev.find((b) => b.id === btn.id);
      if (!prevBtn) {
        if (!btn.isEditing) {
          const { isEditing, ...data } = btn;
          addElement({ id: btn.id, type: 'image_button', data, z_index: 8 });
        }
      } else if (prevBtn.isEditing && !btn.isEditing) {
        const { isEditing, ...data } = btn;
        if (dbIdsRef.current.has(btn.id)) {
          dbSyncUpdate(btn.id, 'image_button', data);
        } else {
          addElement({ id: btn.id, type: 'image_button', data, z_index: 8 });
        }
      } else if (!btn.isEditing && !prevBtn.isEditing) {
        if (JSON.stringify(btn) !== JSON.stringify(prevBtn)) {
          const { isEditing, ...data } = btn;
          dbSyncUpdate(btn.id, 'image_button', data);
        }
      }
    }
    prevImgBtnsRef.current = imageButtons;
  }, [imageButtons, addElement, dbSyncUpdate]);

  // Sync deletions — check if any prev elements are gone from current arrays
  useEffect(() => {
    if (!hydrated.current || !isAdminResolved || !isAdmin) return;
    // Handled by handleDelete* wrappers — they call removeElement directly
  }, []);

  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);

  const isPanningRef = useRef(false);
  const didPanRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const outerRef = useRef<HTMLDivElement>(null);
  const rulesRef = useRef<HTMLDivElement>(null);
  const [panLimitPos, setPanLimitPos] = useState<{ x: number; y: number } | null>(null);

  // Disable cartoon cursors when dev menu open or in dev modes
  const disableCursors = devMenuOpen || mode === 'place' || mode === 'text' || mode === 'textbtn' || mode === 'imgbtn';

  const handleCursorChange = useCallback((cursor: string | null) => {
    pencilActiveRef.current = cursor === "pencil";
    setActiveCursor(cursor);
  }, []);

  const handleImageUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const cx = -offsetX.get() + window.innerWidth / 2;
      const cy = -offsetY.get() + window.innerHeight / 2;
      addImage(url, img.naturalWidth, img.naturalHeight, cx, cy);
    };
    img.src = url;
  }, [addImage, offsetX, offsetY]);

  const handleImageButtonUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const cx = -offsetX.get() + window.innerWidth / 2;
      const cy = -offsetY.get() + window.innerHeight / 2;
      addImageButton(url, img.naturalWidth, img.naturalHeight, '', cx, cy);
    };
    img.src = url;
  }, [addImageButton, offsetX, offsetY]);

  const getCursor = useCallback(() => {
    if (mode === 'place' || mode === 'text' || mode === 'textbtn') return 'crosshair';
    return 'grab';
  }, [mode]);

  useEffect(() => {
    const stop = () => {
      isPanningRef.current = false;
      if (outerRef.current) outerRef.current.style.cursor = getCursor();
    };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, [getCursor]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, textarea")) return;
    if (mode === 'place' || mode === 'text' || mode === 'textbtn' || mode === 'imgbtn') return;
    if (pencilActiveRef.current) return;
    e.preventDefault();
    isPanningRef.current = true;
    didPanRef.current = false;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    if (outerRef.current) outerRef.current.style.cursor = "grabbing";
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didPanRef.current = true;

    const rawX = offsetX.get() + dx;
    const rawY = offsetY.get() + dy;
    const clampedX = Math.min(0, rawX);
    const clampedY = Math.min(2000, Math.max(window.innerHeight - 3000, rawY));
    offsetX.set(clampedX);
    offsetY.set(clampedY);

    if (rawX !== clampedX || rawY !== clampedY) {
      setPanLimitPos({ x: e.clientX, y: e.clientY });
    } else {
      setPanLimitPos(null);
    }

    if (rulesRef.current) {
      rulesRef.current.style.backgroundPosition = `0 ${48 + offsetY.get()}px`;
    }
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
    setPanLimitPos(null);
    if (outerRef.current) outerRef.current.style.cursor = getCursor();
  };

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, textarea")) return;
    if (mode === 'place') {
      if (notes.some((n) => n.isEditing)) return;
      const x = e.clientX - offsetX.get() - 160;
      const y = e.clientY - offsetY.get() - 20;
      addNote(x, y);
    } else if (mode === 'text') {
      if (texts.some((t) => t.isEditing)) return;
      const x = e.clientX - offsetX.get();
      const y = e.clientY - offsetY.get();
      addText(x, y);
    } else if (mode === 'textbtn') {
      if (textButtons.some((b) => b.isEditing)) return;
      const x = e.clientX - offsetX.get();
      const y = e.clientY - offsetY.get();
      addTextButton(x, y);
    }
  };

  // Delete wrappers that also remove from DB
  const handleDeleteNote = useCallback((id: string) => {
    deleteNote(id);
    removeElement(id);
  }, [deleteNote, removeElement]);

  const handleDeleteText = useCallback((id: string) => {
    deleteText(id);
    removeElement(id);
  }, [deleteText, removeElement]);

  const handleDeleteImage = useCallback((id: string) => {
    deleteImage(id);
    removeElement(id);
  }, [deleteImage, removeElement]);

  const handleDeleteTextButton = useCallback((id: string) => {
    deleteTextButton(id);
    removeElement(id);
  }, [deleteTextButton, removeElement]);

  const handleDeleteImageButton = useCallback((id: string) => {
    deleteImageButton(id);
    removeElement(id);
  }, [deleteImageButton, removeElement]);

  // Lock text also removes empty texts — sync deletion to DB
  const handleLockText = useCallback((id: string) => {
    const text = texts.find((t) => t.id === id);
    lockText(id);
    if (text && !text.text.trim()) {
      removeElement(id);
    }
  }, [lockText, texts, removeElement]);

  const handleLockTextButton = useCallback((id: string) => {
    const btn = textButtons.find((b) => b.id === id);
    lockTextButton(id);
    if (btn && !btn.text.trim()) {
      removeElement(id);
    }
  }, [lockTextButton, textButtons, removeElement]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode('pan');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <>
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

      <div
        ref={outerRef}
        style={{
          height: "100vh",
          position: "relative",
          overflow: "hidden",
          userSelect: "none",
          cursor: getCursor(),
          backgroundColor: "#f5f5f0",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
        />
        {isAdmin && (
          <DevButton mode={mode} onModeChange={setMode} onOpenChange={setDevMenuOpen} onImageUpload={handleImageUpload} onImageButtonUpload={handleImageButtonUpload} />
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
          }}
        >
          {/* Red margin line */}
          <div
            style={{
              position: "absolute",
              top: -2000,
              left: "11.5vw",
              width: "0.5vw",
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

          {/* Canvas images */}
          {images.map((img) => (
            <CanvasImage
              key={img.id}
              data={img}
              onUpdate={updateImage}
              onDelete={handleDeleteImage}
              disabled={!!activeCursor}
              readOnly={!isAdmin}
            />
          ))}

          {/* Canvas texts */}
          <div style={{ color: '#292524' }}>
            {texts.map((t) => (
              <CanvasText
                key={t.id}
                data={t}
                onUpdate={updateText}
                onLock={handleLockText}
                onDelete={handleDeleteText}
                disabled={!!activeCursor}
                readOnly={!isAdmin}
              />
            ))}
          </div>

          {/* Canvas text buttons */}
          <div style={{ color: '#292524' }}>
            {textButtons.map((b) => (
              <CanvasTextButton
                key={b.id}
                data={b}
                onUpdate={updateTextButton}
                onLock={handleLockTextButton}
                onDelete={handleDeleteTextButton}
                disabled={activeCursor === 'pencil'}
                devMode={devMenuOpen}
                readOnly={!isAdmin}
              />
            ))}
          </div>

          {/* Canvas image buttons */}
          {imageButtons.map((b) => (
            <CanvasImageButton
              key={b.id}
              data={b}
              onUpdate={updateImageButton}
              onLock={lockImageButton}
              onDelete={handleDeleteImageButton}
              disabled={activeCursor === 'pencil'}
              devMode={devMenuOpen}
              cursorMode={activeCursor}
              readOnly={!isAdmin}
            />
          ))}

          {/* Sticky notes */}
          <div style={{ color: '#292524' }}>
            {notes.map((note) => (
              <StickyNote
                key={note.id}
                note={note}
                onUpdate={updateNote}
                onLock={lockNote}
                onDelete={handleDeleteNote}
                cursorMode={activeCursor}
                devMode={devMenuOpen}
                readOnly={!isAdmin}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </>
  );
}
