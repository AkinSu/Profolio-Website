"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";


const WobblyRect = () => (
  <svg
    className="absolute inset-0 w-full h-full text-[#2c2c2c] pointer-events-none"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M 9,11 C 45,8 85,12 111,9 C 113,45 109,85 112,111 C 85,113 45,109 9,112 C 7,85 11,45 9,11 Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M 11,9 C 45,11 85,7 109,11 C 111,45 113,85 109,109 C 85,111 45,113 11,109 C 9,85 7,45 11,9 Z"
      stroke="currentColor"
      strokeWidth="1"
      opacity="0.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ConnectionLine = () => (
  <div className="flex items-center justify-center pointer-events-none" style={{ width: 30, height: 40, margin: "0 -16px", zIndex: 0 }}>
    <svg viewBox="0 0 100 40" style={{ width: "100%", height: "100%", color: "#2c2c2c", overflow: "visible" }} fill="none">
      <path d="M 0,20 C 30,10 70,30 100,20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 0,22 C 30,12 70,28 100,18" stroke="currentColor" strokeWidth="1" opacity="0.5" strokeLinecap="round" />
    </svg>
  </div>
);

interface HandDrawnButtonProps {
  imageSrc: string;
  alt: string;
  imageScale?: number; // 1 = default size
  rotate?: number;     // degrees; negative = counter-clockwise
  onClick?: () => void;
}

// Layout box for the button image. The on-screen size comes from the CSS transform
// below, which next/image cannot see — it sizes the served asset from the width/height
// props alone. So those must account for imageScale, or a 2.5x button ships a 36px
// thumbnail and stretches it 2.5x. The extra 2x covers retina displays.
const IMG_BOX = 36;

const HandDrawnButton = ({ imageSrc, alt, imageScale = 1, rotate = 0, onClick }: HandDrawnButtonProps) => {
  const intrinsic = Math.round(IMG_BOX * imageScale * 2);
  return (
    <button
      style={{ position: "relative", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", outline: "none", zIndex: 10, pointerEvents: "auto" }}
      className="transition-all duration-150 ease-out drop-shadow-[2px_2px_0_rgba(0,0,0,0.12)] hover:translate-y-px hover:scale-[0.97] active:-translate-y-px active:scale-[1.03]"
      aria-label={alt}
      onClick={onClick}
    >
      <WobblyRect />
      <Image
        src={imageSrc}
        alt={alt}
        width={intrinsic}
        height={intrinsic}
        style={{
          position: "relative",
          zIndex: 10,
          width: IMG_BOX,
          height: IMG_BOX,
          objectFit: "contain",
          mixBlendMode: "multiply",
          userSelect: "none",
          transform: `rotate(${rotate}deg) scale(${imageScale})`,
          transformOrigin: "center",
        }}
        draggable={false}
      />
    </button>
  );
};

interface NavigationProps {
  onCursorChange?: (cursor: string | null) => void;
  disableCursors?: boolean;
  show?: boolean;
  hidePencil?: boolean;
}

export function Navigation({ onCursorChange, disableCursors, show = true, hidePencil }: NavigationProps) {
  // "hand" is the default cursor mode
  const [cursorMode, setCursorMode] = useState<string>("hand");

  // When disableCursors becomes true (dev menu), remove custom cursors / use normal mouse
  useEffect(() => {
    if (disableCursors) {
      const styleEl = document.getElementById("custom-cursor-style");
      styleEl?.remove();
      onCursorChange?.(null);
    }
  }, [disableCursors, onCursorChange]);

  // When disableCursors turns off (dev menu closes), restore hand
  useEffect(() => {
    if (!disableCursors) {
      setCursorMode("hand");
    }
  }, [disableCursors]);

  // When window regains focus, reset to hand (unless dev menu is open)
  useEffect(() => {
    const resetToHand = () => {
      if (!disableCursors) {
        setCursorMode("hand");
      }
    };
    window.addEventListener("focus", resetToHand);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") resetToHand();
    });
    return () => {
      window.removeEventListener("focus", resetToHand);
    };
  }, [disableCursors]);

  // Stable ref to avoid re-running effects when onCursorChange identity changes
  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (disableCursors) return;

    let styleEl = document.getElementById("custom-cursor-style") as HTMLStyleElement | null;

    if (cursorMode === "pencil") {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "custom-cursor-style";
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `* { cursor: url(/pencil-cursor.svg) 2 29, auto !important; }`;
      onCursorChangeRef.current?.("pencil");
    } else if (cursorMode === "hand") {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "custom-cursor-style";
        document.head.appendChild(styleEl);
      }
      const handCSS = [
        `* { cursor: url(/hand-default.png) 16 16, auto !important; }`,
        `button, button *, a, a *, [role="button"], [role="button"] * { cursor: url(/hand-hover.png) 16 16, pointer !important; }`,
        `button:active, button:active *, a:active, a:active *, [role="button"]:active, [role="button"]:active * { cursor: url(/hand-click.png) 16 16, pointer !important; }`,
      ].join('\n');
      styleEl.textContent = handCSS;
      onCursorChangeRef.current?.("hand");

      // Drag cursor swap listeners
      const onDown = (e: PointerEvent) => {
        if ((e.target as HTMLElement).closest("button, a, input, textarea, nav, [role='button']")) return;
        if (document.documentElement.dataset.tilting) return;
        styleEl!.textContent = `* { cursor: url(/hand-drag.png) 16 16, grabbing !important; }`;
      };
      const onUp = () => {
        if (document.documentElement.dataset.tilting) return;
        styleEl!.textContent = handCSS;
      };
      window.addEventListener("pointerdown", onDown);
      window.addEventListener("pointerup", onUp);

      return () => {
        window.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointerup", onUp);
        document.getElementById("custom-cursor-style")?.remove();
      };
    } else {
      styleEl?.remove();
      onCursorChangeRef.current?.(null);
    }

    return () => {
      document.getElementById("custom-cursor-style")?.remove();
    };
  }, [cursorMode, disableCursors]);

  const handlePencilClick = () => setCursorMode(prev => prev === "pencil" ? "hand" : "pencil");
  const handleHandClick = () => setCursorMode("hand");

  return (
    <motion.nav
      className="no-select"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: "12px 32px",
        pointerEvents: "none",
      }}
      initial={{ y: -100, opacity: 0 }}
      animate={show ? { y: 0, opacity: 1 } : { y: -100, opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", maxWidth: 1400, margin: "0 auto" }}>
        {/* Center: Hand-drawn buttons */}
        <div style={{ position: "relative", width: 230, height: 110, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Image
            src="/paper-tape.png"
            alt=""
            width={230}
            height={110}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", mixBlendMode: "multiply", opacity: 0.95, pointerEvents: "none", userSelect: "none" }}
            draggable={false}
          />
          <HandDrawnButton imageSrc="/hand.png" alt="Hand" imageScale={1} onClick={handleHandClick} />
          {!hidePencil && (
            <>
              <ConnectionLine />
              <HandDrawnButton imageSrc="/pencil.png" alt="Pencil" imageScale={1.0} rotate={-20} onClick={handlePencilClick} />
            </>
          )}
        </div>

      </div>
    </motion.nav>
  );
}
