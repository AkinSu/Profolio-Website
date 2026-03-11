"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type CanvasMode = 'pan' | 'place' | 'text' | 'textbtn' | 'imgbtn';

interface DevButtonProps {
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
  onOpenChange?: (open: boolean) => void;
  onImageUpload?: (file: File) => void;
  onImageButtonUpload?: (file: File) => void;
  drawMode?: boolean;
  onDrawModeChange?: (enabled: boolean) => void;
  onClearDrawings?: () => void;
}

export function DevButton({ mode, onModeChange, onOpenChange, onImageUpload, onImageButtonUpload, drawMode, onDrawModeChange, onClearDrawings }: DevButtonProps) {
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgBtnInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const toggleOpen = () => {
    setOpen((o) => !o);
    if (open) { onModeChange('pan'); setConfirmClear(false); onDrawModeChange?.(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === 'image/png' || file.type === 'image/gif')) {
      onImageUpload?.(file);
    }
    e.target.value = '';
  };

  const handleImgBtnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === 'image/png' || file.type === 'image/gif')) {
      onImageButtonUpload?.(file);
    }
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
                    {m === 'pan' ? 'edit' : m === 'place' ? '📌 note' : 'Aa write'}
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
                🖼️ image (.png/.gif)
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/gif"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* Draw toggle + clear */}
            <div style={{ padding: "8px 12px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", letterSpacing: "0.08em", margin: 0 }}>DRAW</p>
                <button
                  onClick={() => onDrawModeChange?.(!drawMode)}
                  style={{
                    position: "relative",
                    width: 36,
                    height: 18,
                    borderRadius: 9,
                    border: "none",
                    background: drawMode ? "rgba(120,200,120,0.5)" : "rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    transition: "background 0.2s",
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 2,
                      left: drawMode ? 20 : 2,
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      background: drawMode ? "#fff" : "rgba(255,255,255,0.4)",
                      transition: "left 0.2s, background 0.2s",
                    }}
                  />
                </button>
              </div>
              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  style={{
                    width: "100%",
                    padding: "5px 0",
                    background: "transparent",
                    color: "rgba(239,68,68,0.6)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: 6,
                    fontSize: 10,
                    fontFamily: "monospace",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                    e.currentTarget.style.color = "rgba(239,68,68,0.9)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "rgba(239,68,68,0.6)";
                  }}
                >
                  clear all drawings
                </button>
              ) : (
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => { onClearDrawings?.(); setConfirmClear(false); }}
                    style={{
                      flex: 1,
                      padding: "5px 0",
                      background: "rgba(239,68,68,0.2)",
                      color: "rgba(239,68,68,0.9)",
                      border: "1px solid rgba(239,68,68,0.4)",
                      borderRadius: 6,
                      fontSize: 10,
                      fontFamily: "monospace",
                      cursor: "pointer",
                    }}
                  >
                    yes, clear
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    style={{
                      flex: 1,
                      padding: "5px 0",
                      background: "transparent",
                      color: "rgba(255,255,255,0.5)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      fontSize: 10,
                      fontFamily: "monospace",
                      cursor: "pointer",
                    }}
                  >
                    cancel
                  </button>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div style={{ padding: "8px 12px 8px" }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", marginBottom: 6, letterSpacing: "0.08em" }}>BUTTONS</p>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => onModeChange('textbtn')}
                  style={{
                    flex: 1,
                    padding: "5px 0",
                    background: mode === 'textbtn' ? "rgba(255,255,255,0.12)" : "transparent",
                    color: mode === 'textbtn' ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${mode === 'textbtn' ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "monospace",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  Aa text
                </button>
                <button
                  onClick={() => imgBtnInputRef.current?.click()}
                  style={{
                    flex: 1,
                    padding: "5px 0",
                    background: "transparent",
                    color: "rgba(255,255,255,0.4)",
                    border: "1px dashed rgba(255,255,255,0.1)",
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
                    e.currentTarget.style.color = "rgba(255,255,255,0.4)";
                  }}
                >
                  🖼 image
                </button>
                <input
                  ref={imgBtnInputRef}
                  type="file"
                  accept="image/png,image/gif"
                  onChange={handleImgBtnChange}
                  style={{ display: 'none' }}
                />
              </div>
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
