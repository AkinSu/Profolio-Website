"use client";

import { Box, Container, Heading, Text, SimpleGrid, VStack } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { Navigation } from "@/components/Navigation";

const MotionBox = motion.create(Box);

const projects = [
  {
    title: "Project One",
    description: "A brief description of your first project",
    tags: ["React", "Three.js", "TypeScript"],
    color: "purple.500",
  },
  {
    title: "Project Two",
    description: "A brief description of your second project",
    tags: ["Next.js", "Chakra UI", "Framer Motion"],
    color: "cyan.500",
  },
  {
    title: "Project Three",
    description: "A brief description of your third project",
    tags: ["Blender", "WebGL", "GLSL"],
    color: "pink.500",
  },
];

export default function ProjectsContent() {
  return (
    <Box minH="100vh" bg="gray.950">
      <Navigation />

      <Container maxW="1400px" pt={32} pb={20}>
        <VStack align="flex-start" gap={12}>
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
              Projects
            </Heading>
            <Text color="whiteAlpha.700" fontSize="xl" maxW="600px">
              A collection of my work showcasing 3D experiences and interactive
              web applications.
            </Text>
          </MotionBox>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={8} w="full">
            {projects.map((project, i) => (
              <MotionBox
                key={project.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
                bg="gray.900"
                borderRadius="xl"
                overflow="hidden"
                cursor="pointer"
                _hover={{ transform: "translateY(-8px)" }}
                transitionDuration="0.3s"
              >
                <Box h="200px" bg={project.color} opacity={0.8} />
                <Box p={6}>
                  <Heading as="h3" fontSize="xl" color="white" mb={2}>
                    {project.title}
                  </Heading>
                  <Text color="whiteAlpha.700" mb={4}>
                    {project.description}
                  </Text>
                  <Box display="flex" gap={2} flexWrap="wrap">
                    {project.tags.map((tag) => (
                      <Text
                        key={tag}
                        fontSize="xs"
                        color="whiteAlpha.600"
                        bg="whiteAlpha.100"
                        px={2}
                        py={1}
                        borderRadius="md"
                      >
                        {tag}
                      </Text>
                    ))}
                  </Box>
                </Box>
              </MotionBox>
            ))}
          </SimpleGrid>
        </VStack>
      </Container>
    </Box>
  );
}
