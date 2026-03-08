"use client";

import { Box, Container, Heading, Text, VStack, HStack } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { Scene3D, FloatingShapes } from "@/components/Scene3D";

const MotionBox = motion.create(Box);

const skills = [
  "JavaScript / TypeScript",
  "React / Next.js",
  "Three.js / WebGL",
  "Blender / MagicaVoxel",
  "Framer Motion",
  "Node.js",
];

export default function About() {
  return (
    <Box minH="100vh" bg="gray.950" position="relative">
      <Navigation />

      {/* Background 3D Scene */}
      <Box
        position="absolute"
        top={0}
        right={0}
        w="50%"
        h="100%"
        opacity={0.5}
        display={{ base: "none", lg: "block" }}
      >
        <Scene3D>
          <FloatingShapes />
        </Scene3D>
      </Box>

      <Container maxW="1400px" pt={32} pb={20} position="relative" zIndex={1}>
        <VStack align="flex-start" gap={12} maxW="600px">
          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Heading
              as="h1"
              fontSize={{ base: "4xl", md: "6xl" }}
              color="white"
              mb={4}
            >
              About Me
            </Heading>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Text color="whiteAlpha.800" fontSize="lg" lineHeight="tall">
              I&apos;m a creative developer passionate about building immersive digital
              experiences. I combine technical expertise with artistic vision to
              create websites that stand out.
            </Text>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Text color="whiteAlpha.800" fontSize="lg" lineHeight="tall">
              My toolkit includes modern web technologies, 3D graphics, and
              animation libraries that allow me to bring ideas to life in the
              browser.
            </Text>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            w="full"
          >
            <Heading as="h2" fontSize="2xl" color="white" mb={6}>
              Skills
            </Heading>
            <HStack gap={3} flexWrap="wrap">
              {skills.map((skill, i) => (
                <MotionBox
                  key={skill}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
                >
                  <Text
                    color="white"
                    bg="whiteAlpha.100"
                    px={4}
                    py={2}
                    borderRadius="full"
                    fontSize="sm"
                    borderWidth="1px"
                    borderColor="whiteAlpha.200"
                  >
                    {skill}
                  </Text>
                </MotionBox>
              ))}
            </HStack>
          </MotionBox>
        </VStack>
      </Container>
    </Box>
  );
}
