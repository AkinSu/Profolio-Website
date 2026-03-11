"use client";

import dynamic from "next/dynamic";

const AboutContent = dynamic(() => import("./AboutContent"), { ssr: false });

export default function About() {
  return <AboutContent />;
}
