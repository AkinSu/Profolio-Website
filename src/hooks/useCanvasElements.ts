import { useState, useEffect, useCallback, useRef } from 'react';

export interface CanvasElement {
  id: string;
  type: string;
  data: Record<string, unknown>;
  z_index: number;
  created_at?: string;
  updated_at?: string;
}

export function useCanvasElements() {
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Debounce timers for updates keyed by element id
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Store pending update data so debounced call uses latest values
  const pendingUpdates = useRef<Map<string, { data: Record<string, unknown>; z_index?: number }>>(new Map());
  // Track element IDs currently being dragged/edited locally — skip poll updates for these
  const lockedIds = useRef<Set<string>>(new Set());

  // Fetch all elements on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/canvas');
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setElements(json.elements || []);
        }
      } catch (err) {
        console.error('Failed to load canvas elements:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // --- Live polling every 2s ---
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      try {
        const res = await fetch('/api/canvas');
        if (!res.ok) return;
        const json = await res.json();
        const incoming: CanvasElement[] = json.elements || [];

        setElements((prev) => {
          // Build a map of current elements by id
          const prevMap = new Map(prev.map((e) => [e.id, e]));
          const incomingMap = new Map(incoming.map((e) => [e.id, e]));

          let changed = false;

          // Check for new or updated elements
          for (const el of incoming) {
            const existing = prevMap.get(el.id);
            if (!existing) {
              changed = true;
              break;
            }
            // Skip elements currently being dragged/edited
            if (lockedIds.current.has(el.id)) continue;
            // Compare updated_at to detect changes
            if (el.updated_at !== existing.updated_at) {
              changed = true;
              break;
            }
          }

          // Check for deleted elements
          if (!changed) {
            for (const e of prev) {
              if (!incomingMap.has(e.id)) {
                changed = true;
                break;
              }
            }
          }

          if (!changed) return prev;

          // Merge: use incoming data but preserve local state for locked elements
          return incoming.map((el) => {
            if (lockedIds.current.has(el.id)) {
              const local = prevMap.get(el.id);
              return local || el;
            }
            return el;
          });
        });
      } catch {
        // Silently ignore poll errors
      }
    }

    function startPolling() {
      if (intervalId) return;
      intervalId = setInterval(poll, 2000);
    }

    function stopPolling() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        poll(); // Immediate fetch when tab becomes visible
        startPolling();
      } else {
        stopPolling();
      }
    }

    // Start polling if tab is visible
    if (document.visibilityState === 'visible') {
      startPolling();
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const addElement = useCallback(
    async (element: CanvasElement) => {
      // Optimistic add
      setElements((prev) => [...prev, element]);

      try {
        const res = await fetch('/api/canvas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(element),
        });
        if (!res.ok) throw new Error(`POST failed: ${res.status}`);
      } catch (err) {
        console.error('Failed to add element:', err);
        // Revert
        setElements((prev) => prev.filter((e) => e.id !== element.id));
      }
    },
    []
  );

  const updateElement = useCallback(
    (id: string, data: Record<string, unknown>, z_index?: number) => {
      // Mark as locked so polling doesn't overwrite during drag
      lockedIds.current.add(id);

      // Optimistic update
      setElements((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, data: { ...e.data, ...data }, ...(z_index !== undefined ? { z_index } : {}) } : e
        )
      );

      // Store latest pending data
      const existing = pendingUpdates.current.get(id);
      pendingUpdates.current.set(id, {
        data: existing ? { ...existing.data, ...data } : data,
        z_index: z_index !== undefined ? z_index : existing?.z_index,
      });

      // Debounce the API call
      const existingTimer = debounceTimers.current.get(id);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(async () => {
        debounceTimers.current.delete(id);
        const pending = pendingUpdates.current.get(id);
        pendingUpdates.current.delete(id);
        if (!pending) return;

        try {
          // Get the full current data for this element
          let fullData: Record<string, unknown> = {};
          setElements((prev) => {
            const el = prev.find((e) => e.id === id);
            if (el) fullData = { ...el.data };
            return prev;
          });

          const res = await fetch('/api/canvas', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, data: fullData, z_index: pending.z_index }),
          });
          if (!res.ok) throw new Error(`PUT failed: ${res.status}`);
        } catch (err) {
          console.error('Failed to update element:', err);
        } finally {
          // Unlock after the debounced write completes
          lockedIds.current.delete(id);
        }
      }, 500);

      debounceTimers.current.set(id, timer);
    },
    []
  );

  const removeElement = useCallback(
    async (id: string) => {
      // Cancel any pending update
      const timer = debounceTimers.current.get(id);
      if (timer) {
        clearTimeout(timer);
        debounceTimers.current.delete(id);
      }
      pendingUpdates.current.delete(id);
      lockedIds.current.delete(id);

      // Optimistic remove — store for revert
      let removed: CanvasElement | undefined;
      setElements((prev) => {
        removed = prev.find((e) => e.id === id);
        return prev.filter((e) => e.id !== id);
      });

      try {
        const res = await fetch('/api/canvas', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) throw new Error(`DELETE failed: ${res.status}`);
      } catch (err) {
        console.error('Failed to delete element:', err);
        // Revert
        if (removed) {
          setElements((prev) => [...prev, removed!]);
        }
      }
    },
    []
  );

  return { elements, isLoading, addElement, updateElement, removeElement };
}
