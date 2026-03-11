"use client";

import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ReactNode, useState, useEffect } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ChakraProvider value={defaultSystem}>
      {mounted ? children : null}
    </ChakraProvider>
  );
}
