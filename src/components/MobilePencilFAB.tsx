"use client";

import Image from "next/image";

interface Props {
  isActive: boolean;
  onToggle: () => void;
}

export function MobilePencilFAB({ isActive, onToggle }: Props) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2" style={{ pointerEvents: "auto" }}>
      {/* Active mode label */}
      {isActive && (
        <div
          className="bg-black text-white px-3 py-1.5 rounded-full text-sm animate-bounce"
          style={{ fontFamily: "Patrick Hand" }}
        >
          Tap to stop ✏️
        </div>
      )}
      <button
        onClick={onToggle}
        className={`relative w-28 h-28 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 ${isActive ? "drop-shadow-[0_0_12px_rgba(0,0,0,0.4)] scale-110" : "drop-shadow-md"}`}
        aria-label={isActive ? "Stop drawing" : "Start drawing"}
      >
        <img
          src="/torn-paper-circle.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <img
          src="/pencil.png"
          alt="Draw"
          className={`relative z-10 w-20 h-20 object-contain transition-transform duration-300 ${isActive ? "rotate-[-15deg]" : "rotate-[15deg]"}`}
        />
        {/* Active pulse ring */}
        {isActive && (
          <span className="absolute inset-0 rounded-full border-2 border-black animate-ping opacity-30" />
        )}
      </button>
    </div>
  );
}
