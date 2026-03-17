import { NextResponse } from "next/server";

import { getRevisionById } from "@/lib/server/project-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ revisionId: string }> }
) {
  const { revisionId } = await params;
  const { project, revision } = await getRevisionById(revisionId);

  if (!revision) {
    return NextResponse.json({ error: "That revision could not be found." }, { status: 404 });
  }

  return NextResponse.json({ project, revision });
}
