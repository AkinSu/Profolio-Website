"use client";

import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ReactNode, useState, useEffect } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render children without Chakra on server to avoid hydration mismatch
  // The page uses ssr:false anyway, so Chakra components won't render on server
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ChakraProvider value={defaultSystem}>
      {children}
    </ChakraProvider>
  );
}
