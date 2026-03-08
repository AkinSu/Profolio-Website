"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Box, Container, Heading, Text, VStack, Button, HStack } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { IntroAnimation } from "@/components/IntroAnimation";

const MotionBox = motion.create(Box);
const MotionHeading = motion.create(Heading);
const MotionText = motion.create(Text);

export default function HomeContent() {
  const [overlayDone, setOverlayDone] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Stop panning if mouse leaves window
  useEffect(() => {
    const stop = () => { isPanningRef.current = false; };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't hijack clicks on buttons/links
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    isPanningRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    setOffset(prev => ({
      // Left boundary: offset.x cannot go above 0 (can't pan right past the margin)
      x: Math.min(0, prev.x + dx),
      y: prev.y + dy,
    }));
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
  };

  return (
    <>
      <IntroAnimation onComplete={() => setOverlayDone(true)} />

      {/* Red margin line — portalled directly into document.body, immune to all parent CSS */}
      {typeof window !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            bottom: 0,
            left: "11.5vw",
            width: "0.5vw",
            backgroundColor: "rgba(220,80,80,0.3)",
            zIndex: 50,
            pointerEvents: "none",
          }}
        />,
        document.body
      )}

      <Box
        minH="100vh"
        position="relative"
        overflow="hidden"
        userSelect="none"
        cursor={isPanningRef.current ? "grabbing" : "grab"}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          backgroundColor: "#f5f5f0",
          backgroundImage: `
            repeating-linear-gradient(transparent, transparent 31px, rgba(140,180,220,0.25) 31px, rgba(140,180,220,0.25) 32px)
          `,
          backgroundSize: "100% 32px",
          backgroundPosition: `0 ${48 + offset.y}px`,
        }}
      >
        {/* Navigation — fixed, doesn't move with pan */}
        <Navigation />

        {/* Hero Content */}
        <Container
          maxW="1400px"
          position="relative"
          zIndex={1}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px)`,
            willChange: "transform",
          }}
        >
          <VStack
            minH="100vh"
            justify="center"
            align="flex-start"
            gap={6}
            py={20}
          >
            <MotionBox>
              <Text
                color="purple.600"
                fontSize="lg"
                fontWeight="medium"
                letterSpacing="wider"
              >
                CREATIVE DEVELOPER
              </Text>
            </MotionBox>

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
              I craft immersive web experiences with 3D graphics, smooth animations,
              and clean code. Let&apos;s create something amazing together.
            </MotionText>

            <MotionBox>
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
            </MotionBox>
          </VStack>
        </Container>

        {/* Scroll Indicator */}
        <MotionBox
          position="absolute"
          bottom={8}
          left="50%"
          style={{ transform: `translateX(calc(-50% + ${offset.x}px))` }}
          animate={{ y: [0, 10, 0] }}
          transition={{ y: { repeat: Infinity, duration: 1.5 } }}
          zIndex={1}
        >
          <VStack gap={2}>
            <Text color="gray.400" fontSize="sm">
              drag to explore
            </Text>
            <Box
              w="1px"
              h="40px"
              bg="linear-gradient(to bottom, rgba(0,0,0,0.2), transparent)"
            />
          </VStack>
        </MotionBox>
      </Box>
    </>
  );
}
