"use client";

import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ReactNode, useState, useEffect } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <ChakraProvider value={defaultSystem}>
      {children}
    </ChakraProvider>
  );
}
