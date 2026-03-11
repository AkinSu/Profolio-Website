"use client";

import { PaperCrumple } from "./PaperCrumple";

interface IntroAnimationProps {
  onComplete: () => void;
}

export function IntroAnimation({ onComplete }: IntroAnimationProps) {
  console.log("[IntroAnimation] rendering, onComplete:", typeof onComplete);
  return <PaperCrumple onComplete={onComplete} />;
}
