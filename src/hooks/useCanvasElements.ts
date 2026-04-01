import { useState, useEffect, useCallback, useRef } from 'react';

export interface CanvasElement {
  id: string;
  type: string;
  data: Record<string, unknown>;
  z_index: number;
  created_at?: string;
  updated_at?: string;
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

/** Coerce numeric fields that JSONB may return as strings */
function coerceData(d: Record<string, unknown>): Record<string, unknown> {
  const out = { ...d };
  if ('x' in out) out.x = num(out.x, 0);
  if ('y' in out) out.y = num(out.y, 0);
  if ('width' in out) out.width = num(out.width, 300);
  if ('height' in out) out.height = num(out.height, 200);
  if ('fontSize' in out) out.fontSize = num(out.fontSize, 28);
  if ('rotation' in out) out.rotation = num(out.rotation, 0);
  if ('naturalWidth' in out) out.naturalWidth = num(out.naturalWidth, 300);
  if ('naturalHeight' in out) out.naturalHeight = num(out.naturalHeight, 200);
  return out;
}

function stripIsEditing(data: Record<string, unknown>): Record<string, unknown> {
  const { isEditing, ...rest } = data;
  return rest;
}

export function useCanvasElements(isAdmin: boolean) {
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Always-current refs for reading in async callbacks
  const elementsRef = useRef<CanvasElement[]>([]);
  elementsRef.current = elements;
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;

  // IDs that exist locally but haven't been POSTed to DB yet
  const unpersistedIds = useRef<Set<string>>(new Set());

  // Debounce timers for PUT updates
  const updateTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Fetch from API, coerce numbers, mark all as not editing
  const fetchElements = useCallback(async (): Promise<CanvasElement[] | null> => {
    try {
      const res = await fetch('/api/canvas');
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const json = await res.json();
      return (json.elements || []).map((e: CanvasElement) => ({
        ...e,
        data: { ...coerceData(e.data), isEditing: false },
      }));
    } catch (err) {
      console.error('Failed to load canvas elements:', err);
      return null;
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const els = await fetchElements();
      if (!cancelled && els) setElements(els);
      if (!cancelled) setIsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [fetchElements]);

  // Polling — visitors replace state, admin merges new/updated elements
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      const els = await fetchElements();
      if (!els) return;

      if (!isAdmin) {
        // Visitors: replace DB state but keep ephemeral (unpersisted) local drawings
        setElements((prev) => {
          const ephemeral = prev.filter((e) => unpersistedIds.current.has(e.id));
          return [...els, ...ephemeral];
        });
      } else {
        // Admin: merge — add new elements, update existing ones that aren't being edited
        // and don't have pending debounced updates
        setElements((prev) => {
          const prevMap = new Map(prev.map((e) => [e.id, e]));
          const remoteIds = new Set(els.map((e) => e.id));

          // Start with remote elements, preserving local state for actively edited ones
          const merged: CanvasElement[] = els.map((remote) => {
            const local = prevMap.get(remote.id);
            if (!local) return remote; // new from remote
            // Keep local version if being edited or has pending update
            if (local.data.isEditing || updateTimers.current.has(remote.id) || unpersistedIds.current.has(remote.id)) {
              return local;
            }
            return remote;
          });

          // Keep unpersisted local elements (not yet POSTed)
          for (const local of prev) {
            if (unpersistedIds.current.has(local.id) && !remoteIds.has(local.id)) {
              merged.push(local);
            }
          }

          return merged;
        });
      }
    }

    function start() {
      if (intervalId) return;
      intervalId = setInterval(poll, 2000);
    }

    function stop() {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') { poll(); start(); }
      else stop();
    }

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [isAdmin, fetchElements]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => { updateTimers.current.forEach((t) => clearTimeout(t)); };
  }, []);

  /** Add element to local state. If persist=true, POST immediately. Otherwise mark as unpersisted. */
  const addElement = useCallback(
    async (element: CanvasElement, persist = false) => {
      setElements((prev) => [...prev, element]);

      if (persist) {
        try {
          const res = await fetch('/api/canvas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: element.id, type: element.type,
              data: stripIsEditing(element.data), z_index: element.z_index,
            }),
          });
          if (!res.ok) throw new Error(`POST failed: ${res.status}`);
        } catch (err) {
          console.error('Failed to add element:', err);
          setElements((prev) => prev.filter((e) => e.id !== element.id));
        }
      } else {
        unpersistedIds.current.add(element.id);
      }
    },
    []
  );

  /** Persist a locally-added element: POST if new, immediate PUT if already persisted. */
  const persistElement = useCallback(async (id: string) => {
    if (!isAdminRef.current) return;
    // Cancel any pending debounced update
    const timer = updateTimers.current.get(id);
    if (timer) { clearTimeout(timer); updateTimers.current.delete(id); }

    const element = elementsRef.current.find((e) => e.id === id);
    if (!element) return;

    const cleanData = stripIsEditing(element.data);
    const isNew = unpersistedIds.current.has(id);

    if (isNew) {
      unpersistedIds.current.delete(id);
      try {
        const res = await fetch('/api/canvas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, type: element.type, data: cleanData, z_index: element.z_index }),
        });
        if (!res.ok) throw new Error(`POST failed: ${res.status}`);
      } catch (err) {
        console.error('Failed to persist element:', err);
      }
    } else {
      try {
        const res = await fetch('/api/canvas', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, data: cleanData, z_index: element.z_index }),
        });
        if (!res.ok) throw new Error(`PUT failed: ${res.status}`);
      } catch (err) {
        console.error('Failed to update element:', err);
      }
    }
  }, []);

  /** Update element data locally. If persisted and real data changed, debounced PUT. */
  const updateElement = useCallback(
    (id: string, dataUpdates: Record<string, unknown>, z_index?: number) => {
      setElements((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, data: { ...e.data, ...dataUpdates }, ...(z_index !== undefined ? { z_index } : {}) }
            : e
        )
      );

      // Skip API call if not admin, unpersisted, or only isEditing changed
      if (!isAdminRef.current) return;
      if (unpersistedIds.current.has(id)) return;
      const hasRealChanges = Object.keys(dataUpdates).some((k) => k !== 'isEditing');
      if (!hasRealChanges && z_index === undefined) return;

      // Debounced PUT
      const existing = updateTimers.current.get(id);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        updateTimers.current.delete(id);

        const el = elementsRef.current.find((e) => e.id === id);
        if (!el) return;
        const fullData = stripIsEditing(el.data);
        const currentZ = el.z_index;

        try {
          const res = await fetch('/api/canvas', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, data: fullData, z_index: currentZ }),
          });
          if (!res.ok) throw new Error(`PUT failed: ${res.status}`);
        } catch (err) {
          console.error('Failed to update element:', err);
        }
      }, 500);

      updateTimers.current.set(id, timer);
    },
    []
  );

  /** Remove element locally + DELETE from DB if it was persisted. */
  const removeElement = useCallback(async (id: string) => {
    // Cancel pending updates
    const timer = updateTimers.current.get(id);
    if (timer) { clearTimeout(timer); updateTimers.current.delete(id); }

    const wasPersisted = !unpersistedIds.current.has(id);
    unpersistedIds.current.delete(id);

    let removed: CanvasElement | undefined;
    setElements((prev) => {
      removed = prev.find((e) => e.id === id);
      return prev.filter((e) => e.id !== id);
    });

    if (wasPersisted && isAdminRef.current) {
      try {
        const res = await fetch('/api/canvas', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) throw new Error(`DELETE failed: ${res.status}`);
      } catch (err) {
        console.error('Failed to delete element:', err);
        if (removed) setElements((prev) => [...prev, removed!]);
      }
    }
  }, []);

  return { elements, setElements, isLoading, addElement, persistElement, updateElement, removeElement };
}
