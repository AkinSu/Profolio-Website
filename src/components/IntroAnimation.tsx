"use client";

import { PaperCrumple } from "./PaperCrumple";

interface IntroAnimationProps {
  onComplete: () => void;
}

export function IntroAnimation({ onComplete }: IntroAnimationProps) {
  return <PaperCrumple onComplete={onComplete} />;
}
