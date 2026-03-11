"use client";

import dynamic from "next/dynamic";

const ContactContent = dynamic(() => import("./ContactContent"), { ssr: false });

export default function Contact() {
  return <ContactContent />;
}
