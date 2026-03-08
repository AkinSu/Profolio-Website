"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

interface ModelProps {
  url: string;
  scale?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  autoRotate?: boolean;
}

export function Model({
  url,
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  autoRotate = false,
}: ModelProps) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (autoRotate && ref.current) {
      ref.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <primitive
      ref={ref}
      object={scene.clone()}
      scale={scale}
      position={position}
      rotation={rotation}
    />
  );
}

// Preload models for better performance
export function preloadModel(url: string) {
  useGLTF.preload(url);
}
