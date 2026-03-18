import { NextResponse } from "next/server";

import { getRevisionById } from "@/lib/server/project-store";
import { ensureRevisionJob } from "@/lib/server/revision-job";

export const runtime = "nodejs";

function isWorkingStatus(status: string) {
  return (
    status === "queued" ||
    status === "generating_source_image" ||
    status === "generating_line_art"
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ revisionId: string }> }
) {
  const { revisionId } = await params;
  let { project, revision } = await getRevisionById(revisionId);

  if (!revision) {
    return NextResponse.json({ error: "That revision could not be found." }, { status: 404 });
  }

  if (isWorkingStatus(revision.status)) {
    await ensureRevisionJob(revision.id, project.id);
    ({ project, revision } = await getRevisionById(revisionId, project.id));

    if (!revision) {
      return NextResponse.json({ error: "That revision could not be found." }, { status: 404 });
    }
  }

  return NextResponse.json({ project, revision });
}
