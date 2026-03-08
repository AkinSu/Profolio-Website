"use client";

import { useState } from "react";
import { Box, Container, Heading, Text, VStack, Button, HStack } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { IntroAnimation } from "@/components/IntroAnimation";

const MotionBox = motion.create(Box);
const MotionHeading = motion.create(Heading);
const MotionText = motion.create(Text);

const paperBg = {
  backgroundColor: "#f5f5f0",
  backgroundImage: `
    repeating-linear-gradient(transparent, transparent 31px, rgba(140,180,220,0.25) 31px, rgba(140,180,220,0.25) 32px),
    linear-gradient(90deg, transparent 11.5%, rgba(220,80,80,0.3) 11.5%, rgba(220,80,80,0.3) 12%, transparent 12%)
  `,
  backgroundSize: "100% 32px, 100% 100%",
  backgroundPosition: "0 48px, 0 0",
};

export default function HomeContent() {
  const [overlayDone, setOverlayDone] = useState(false);

  return (
    <>
      <IntroAnimation onComplete={() => setOverlayDone(true)} />

      <div>
        <Box
          minH="100vh"
          position="relative"
          overflow="hidden"
          style={paperBg}
        >
          <Navigation />

          {/* Hero Content */}
          <Container maxW="1400px" position="relative" zIndex={1}>
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
            transform="translateX(-50%)"
            animate={{ opacity: 1, y: [0, 10, 0] }}
            transition={{
              opacity: { delay: 1 },
              y: { repeat: Infinity, duration: 1.5 },
            }}
          >
            <VStack gap={2}>
              <Text color="gray.400" fontSize="sm">
                Scroll to explore
              </Text>
              <Box
                w="1px"
                h="40px"
                bg="linear-gradient(to bottom, rgba(0,0,0,0.2), transparent)"
              />
            </VStack>
          </MotionBox>
        </Box>
      </div>
    </>
  );
}
