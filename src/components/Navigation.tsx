"use client";

import { useEffect, useState } from "react";
import { Box, Flex, Text, HStack } from "@chakra-ui/react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";


const MotionBox = motion.create(Box);
const MotionText = motion.create(Text);

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
  onClick?: () => void;
}

const HandDrawnButton = ({ imageSrc, alt, imageScale = 1, onClick }: HandDrawnButtonProps) => (
  <button
    style={{ position: "relative", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", cursor: "default", outline: "none", zIndex: 10 }}
    className="transition-all duration-150 ease-out drop-shadow-[2px_2px_0_rgba(0,0,0,0.12)] hover:translate-y-px hover:scale-[0.97] active:-translate-y-px active:scale-[1.03]"
    aria-label={alt}
    onClick={onClick}
  >
    <WobblyRect />
    <Image
      src={imageSrc}
      alt={alt}
      width={36}
      height={36}
      style={{
        position: "relative",
        zIndex: 10,
        objectFit: "contain",
        mixBlendMode: "multiply",
        userSelect: "none",
        transform: `scale(${imageScale})`,
        transformOrigin: "center",
      }}
      draggable={false}
    />
  </button>
);

const navItems = [
  { name: "Home", href: "/" },
  { name: "Projects", href: "/projects" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
];

export function Navigation() {
  const [cursorImage, setCursorImage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    let styleEl = document.getElementById("custom-cursor-style") as HTMLStyleElement | null;

    if (cursorImage) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "custom-cursor-style";
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `* { cursor: url(${cursorImage}) 16 16, auto !important; }`;
    } else {
      styleEl?.remove();
    }

    return () => {
      document.getElementById("custom-cursor-style")?.remove();
    };
  }, [cursorImage]);

  const handlePencilClick = () => setCursorImage(prev => prev === "/pencil-cursor.png" ? null : "/pencil-cursor.png");
  const handleHandClick = () => setCursorImage(prev => prev === "/hand-cursor.png" ? null : "/hand-cursor.png");

  return (
    <MotionBox
      as="nav"
      position="fixed"
      top={0}
      left={0}
      right={0}
      zIndex={100}
      px={8}
      py={3}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <Flex justify="space-between" align="center" maxW="1400px" mx="auto">
        {/* Left: Logo */}
        <MotionText
          fontSize="xl"
          fontWeight="bold"
          color="gray.800"
          style={{ fontFamily: "'PaperHand', cursive" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Akintunji Sule
        </MotionText>

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
          <ConnectionLine />
          <HandDrawnButton imageSrc="/pencil.png" alt="Pencil" imageScale={2.5} onClick={handlePencilClick} />

        </div>

        {/* Right: Nav links */}
        <HStack gap={8}>
          {navItems.map((item, i) => (
            <MotionBox
              key={item.name}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
            >
              <Link href={item.href}>
                <Text
                  color="gray.600"
                  fontSize="sm"
                  fontWeight="medium"
                  letterSpacing="wide"
                  _hover={{ color: "gray.900" }}
                  transition="color 0.2s"
                  cursor="pointer"
                >
                  {item.name}
                </Text>
              </Link>
            </MotionBox>
          ))}
        </HStack>
      </Flex>
    </MotionBox>
  );
}
