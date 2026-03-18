import { unstable_noStore as noStore } from "next/cache";

import { LineArtWorkspace } from "@/components/line-art-workspace";
import { createEmptyProject } from "@/lib/server/project-store";

export default async function Home() {
  noStore();

  const project = createEmptyProject();

  return <LineArtWorkspace initialProject={project} />;
}
