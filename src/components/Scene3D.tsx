"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Float } from "@react-three/drei";
import { Suspense, ReactNode } from "react";

interface Scene3DProps {
  children: ReactNode;
  controls?: boolean;
  className?: string;
}

export function Scene3D({ children, controls = false, className }: Scene3DProps) {
  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <Environment preset="city" />
          {children}
          {controls && <OrbitControls enableZoom={false} enablePan={false} />}
        </Suspense>
      </Canvas>
    </div>
  );
}

// Floating geometric shapes for visual interest
export function FloatingShapes() {
  return (
    <>
      <Float speed={2} rotationIntensity={1} floatIntensity={2}>
        <mesh position={[-2, 1, 0]}>
          <icosahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial color="#8b5cf6" metalness={0.8} roughness={0.2} />
        </mesh>
      </Float>

      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={1.5}>
        <mesh position={[2, -0.5, -1]}>
          <octahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color="#06b6d4" metalness={0.8} roughness={0.2} />
        </mesh>
      </Float>

      <Float speed={2.5} rotationIntensity={1.5} floatIntensity={2.5}>
        <mesh position={[0, 2, -2]}>
          <torusGeometry args={[0.4, 0.15, 16, 32]} />
          <meshStandardMaterial color="#f472b6" metalness={0.8} roughness={0.2} />
        </mesh>
      </Float>

      <Float speed={1.8} rotationIntensity={0.8} floatIntensity={1.8}>
        <mesh position={[-1.5, -1.5, 0.5]}>
          <dodecahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
        </mesh>
      </Float>

      <Float speed={2.2} rotationIntensity={1.2} floatIntensity={2}>
        <mesh position={[1.5, 1.5, 1]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#34d399" metalness={0.8} roughness={0.2} />
        </mesh>
      </Float>
    </>
  );
}
