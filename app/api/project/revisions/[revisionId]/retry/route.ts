import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/server/rate-limit";
import { retryRevision } from "@/lib/server/project-store";
import { startRevisionJob } from "@/lib/server/revision-job";

export const runtime = "nodejs";

function getClientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for") ?? "local";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ revisionId: string }> }
) {
  if (!checkRateLimit(`retry:${getClientKey(request)}`, 20, 60_000)) {
    return NextResponse.json(
      {
        error: "You’re retrying too quickly. Please wait a moment and try again."
      },
      { status: 429 }
    );
  }

  try {
    const { revisionId } = await params;
    const { project, revision } = await retryRevision(revisionId);

    startRevisionJob(revision.id);

    return NextResponse.json({ project, revision });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retry that revision.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
