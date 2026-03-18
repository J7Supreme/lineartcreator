import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";

import { LineArtWorkspace } from "@/components/line-art-workspace";
import { createEmptyProject } from "@/lib/server/project-store";

export const metadata: Metadata = {
  title: "Line Art Creator | J7Supreme",
  description: "Create printable cartoon line art by describing what you want and refining it with simple edits."
};

export default async function LineArtPage() {
  noStore();

  const project = createEmptyProject();

  return <LineArtWorkspace initialProject={project} />;
}
