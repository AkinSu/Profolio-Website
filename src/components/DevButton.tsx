"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type CanvasMode = 'pan' | 'place' | 'text';

interface DevButtonProps {
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
  onOpenChange?: (open: boolean) => void;
  onImageUpload?: (file: File) => void;
}

export function DevButton({ mode, onModeChange, onOpenChange, onImageUpload }: DevButtonProps) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const toggleOpen = () => {
    setOpen((o) => !o);
    if (open) onModeChange('pan');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'image/png') {
      onImageUpload?.(file);
    }
    // Reset so same file can be re-uploaded
    e.target.value = '';
  };

  return (
    <div
      className="no-select"
      style={{
        position: "fixed",
        bottom: 32,
        right: 32,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6,
      }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{
              background: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              overflow: "hidden",
              minWidth: 180,
            }}
          >
            {/* Mode toggles */}
            <div style={{ padding: "8px 12px 6px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", marginBottom: 6, letterSpacing: "0.08em" }}>MODE</p>
              <div style={{ display: "flex", gap: 6 }}>
                {(['pan', 'place', 'text'] as CanvasMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => onModeChange(m)}
                    style={{
                      flex: 1,
                      padding: "5px 0",
                      background: mode === m ? "rgba(255,255,255,0.12)" : "transparent",
                      color: mode === m ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                      border: `1px solid ${mode === m ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: "monospace",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {m === 'pan' ? 'edit' : m === 'place' ? '📌 note' : '✏️ write'}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload image */}
            <div style={{ padding: "8px 12px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", marginBottom: 6, letterSpacing: "0.08em" }}>UPLOAD</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: "100%",
                  padding: "6px 0",
                  background: "transparent",
                  color: "rgba(255,255,255,0.6)",
                  border: "1px dashed rgba(255,255,255,0.15)",
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: "monospace",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.9)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "rgba(255,255,255,0.6)";
                }}
              >
                🖼️ image (.png)
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={toggleOpen}
        style={{
          padding: "6px 14px",
          background: "#1a1a1a",
          color: "rgba(255,255,255,0.75)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8,
          fontSize: 12,
          fontFamily: "monospace",
          cursor: "pointer",
          letterSpacing: "0.05em",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#1a1a1a")}
      >
        dev {open ? "▴" : "▾"}
      </button>
    </div>
  );
}
