"use client";

import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  Input,
  Button,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { Navigation } from "@/components/Navigation";

const MotionBox = motion.create(Box);

export default function ContactContent() {
  return (
    <Box minH="100vh" bg="gray.950">
      <Navigation />

      <Container maxW="800px" pt={32} pb={20}>
        <VStack align="flex-start" gap={8}>
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
              Get in Touch
            </Heading>
            <Text color="whiteAlpha.700" fontSize="xl">
              Have a project in mind? Let&apos;s talk about it.
            </Text>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            w="full"
          >
            <VStack as="form" gap={6} align="stretch">
              <Box>
                <Text color="whiteAlpha.800" mb={2} fontSize="sm">
                  Name
                </Text>
                <Input
                  placeholder="Your name"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  color="white"
                  _placeholder={{ color: "whiteAlpha.400" }}
                  _hover={{ borderColor: "whiteAlpha.400" }}
                  _focus={{
                    borderColor: "purple.500",
                    boxShadow: "0 0 0 1px var(--chakra-colors-purple-500)",
                  }}
                  size="lg"
                />
              </Box>

              <Box>
                <Text color="whiteAlpha.800" mb={2} fontSize="sm">
                  Email
                </Text>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  color="white"
                  _placeholder={{ color: "whiteAlpha.400" }}
                  _hover={{ borderColor: "whiteAlpha.400" }}
                  _focus={{
                    borderColor: "purple.500",
                    boxShadow: "0 0 0 1px var(--chakra-colors-purple-500)",
                  }}
                  size="lg"
                />
              </Box>

              <Box>
                <Text color="whiteAlpha.800" mb={2} fontSize="sm">
                  Message
                </Text>
                <Input
                  as="textarea"
                  placeholder="Tell me about your project..."
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  color="white"
                  _placeholder={{ color: "whiteAlpha.400" }}
                  _hover={{ borderColor: "whiteAlpha.400" }}
                  _focus={{
                    borderColor: "purple.500",
                    boxShadow: "0 0 0 1px var(--chakra-colors-purple-500)",
                  }}
                  minH="150px"
                  pt={3}
                />
              </Box>

              <Button
                size="lg"
                bg="purple.500"
                color="white"
                _hover={{ bg: "purple.600" }}
                w="full"
              >
                Send Message
              </Button>
            </VStack>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Text color="whiteAlpha.600" fontSize="sm">
              Or reach out directly at{" "}
              <Text as="span" color="purple.400">
                your@email.com
              </Text>
            </Text>
          </MotionBox>
        </VStack>
      </Container>
    </Box>
  );
}
