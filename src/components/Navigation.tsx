"use client";

import { Box, Flex, Text, HStack } from "@chakra-ui/react";
import { motion } from "framer-motion";
import Link from "next/link";

const MotionBox = motion.create(Box);
const MotionText = motion.create(Text);

const navItems = [
  { name: "Home", href: "/" },
  { name: "Projects", href: "/projects" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
];

export function Navigation() {
  return (
    <MotionBox
      as="nav"
      position="fixed"
      top={0}
      left={0}
      right={0}
      zIndex={100}
      px={8}
      py={4}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <Flex justify="space-between" align="center" maxW="1400px" mx="auto">
        <MotionText
          fontSize="xl"
          fontWeight="bold"
          color="gray.800"
          style={{ fontFamily: "'Caveat', cursive" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          AKIN SULE
        </MotionText>

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
