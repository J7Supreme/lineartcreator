import { unstable_noStore as noStore } from "next/cache";

import { LineArtWorkspace } from "@/components/line-art-workspace";
import { getCurrentProject } from "@/lib/server/project-store";

export default async function Home() {
  noStore();

  const project = await getCurrentProject();

  return <LineArtWorkspace initialProject={project} />;
}
