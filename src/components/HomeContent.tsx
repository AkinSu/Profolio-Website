"use client";

import { useRef, useState, useEffect } from "react";
import { Container, Heading, Text, VStack, Button, HStack } from "@chakra-ui/react";
import { motion, useMotionValue } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { IntroAnimation } from "@/components/IntroAnimation";

const MotionHeading = motion.create(Heading);
const MotionText = motion.create(Text);

export default function HomeContent() {
  const [overlayDone, setOverlayDone] = useState(false);

  // MotionValues update the DOM transform directly — zero React re-renders while panning
  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);

  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const outerRef = useRef<HTMLDivElement>(null);
  const rulesRef = useRef<HTMLDivElement>(null);

  // Stop pan if mouse leaves window
  useEffect(() => {
    const stop = () => {
      isPanningRef.current = false;
      if (outerRef.current) outerRef.current.style.cursor = "grab";
    };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    isPanningRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    if (outerRef.current) outerRef.current.style.cursor = "grabbing";
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    // Left boundary: can't pan right past the margin
    offsetX.set(Math.min(0, offsetX.get() + dx));
    offsetY.set(offsetY.get() + dy);

    // Blue rules background updates via DOM ref — no re-render needed
    if (rulesRef.current) {
      rulesRef.current.style.backgroundPosition = `0 ${48 + offsetY.get()}px`;
    }
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
    if (outerRef.current) outerRef.current.style.cursor = "grab";
  };

  return (
    <>
      <IntroAnimation onComplete={() => setOverlayDone(true)} />

      {/* Plain div — no Chakra, no potential CSS containment surprises */}
      <div
        ref={outerRef}
        style={{
          minHeight: "100vh",
          position: "relative",
          overflow: "hidden",
          userSelect: "none",
          cursor: "grab",
          backgroundColor: "#f5f5f0",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <Navigation />

        {/* Layer 1: Blue ruled lines — shifts Y only, updated via DOM ref */}
        <div
          ref={rulesRef}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, rgba(140,180,220,0.25) 31px, rgba(140,180,220,0.25) 32px)",
            backgroundSize: "100% 32px",
            backgroundPosition: "0 48px",
            zIndex: 0,
          }}
        />

        {/* Layer 2+3: Pan layer — shifts X and Y together via MotionValues */}
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            x: offsetX,
            y: offsetY,
          }}
        >
          {/* Red margin line — part of the paper, rides with the pan layer.
              Tall enough (5000px, starting -2000px above) to stay visible
              no matter how far up or down you pan. */}
          <div
            style={{
              position: "absolute",
              top: -2000,
              left: "11.5vw",
              width: "0.5vw",
              height: 5000,
              backgroundColor: "rgba(220,80,80,0.3)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />

          {/* Hero content */}
          <Container maxW="1400px" position="relative" zIndex={1}>
            <VStack minH="100vh" justify="center" align="flex-start" gap={6} py={20}>
              <Text
                color="purple.600"
                fontSize="lg"
                fontWeight="medium"
                letterSpacing="wider"
              >
                CREATIVE DEVELOPER
              </Text>

              <MotionHeading
                as="h1"
                fontSize={{ base: "4xl", md: "6xl", lg: "8xl" }}
                fontWeight="bold"
                color="gray.800"
                lineHeight="1.1"
                maxW="800px"
                style={{ fontFamily: "'Caveat', cursive" }}
              >
                Building digital
                <br />
                <Text as="span" color="blue.500">
                  experiences
                </Text>
              </MotionHeading>

              <MotionText
                fontSize={{ base: "lg", md: "xl" }}
                color="gray.600"
                maxW="600px"
              >
                I craft immersive web experiences with 3D graphics, smooth
                animations, and clean code. Let&apos;s create something amazing
                together.
              </MotionText>

              <HStack gap={4} mt={4}>
                <Button
                  size="lg"
                  bg="purple.600"
                  color="white"
                  _hover={{ bg: "purple.700", transform: "translateY(-2px)" }}
                  transition="all 0.2s"
                  px={8}
                >
                  View Projects
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  borderColor="gray.400"
                  color="gray.700"
                  _hover={{ borderColor: "gray.700", bg: "blackAlpha.50" }}
                  transition="all 0.2s"
                  px={8}
                >
                  Get in Touch
                </Button>
              </HStack>
            </VStack>
          </Container>
        </motion.div>

        {/* Drag hint — outside pan layer, stays centered at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <span style={{ color: "rgba(0,0,0,0.3)", fontSize: 13, fontFamily: "'Caveat', cursive", letterSpacing: "0.05em" }}>
            drag to explore
          </span>
          <div style={{ width: 1, height: 40, background: "linear-gradient(to bottom, rgba(0,0,0,0.2), transparent)" }} />
        </div>
      </div>
    </>
  );
}
