"use client";

import dynamic from "next/dynamic";

const ProjectsContent = dynamic(() => import("./ProjectsContent"), { ssr: false });

export default function Projects() {
  return <ProjectsContent />;
}
