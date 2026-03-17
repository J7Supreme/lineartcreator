import { NextRequest, NextResponse } from "next/server";

import { restoreRevision } from "@/lib/server/project-store";
import { checkRateLimit } from "@/lib/server/rate-limit";

function getClientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for") ?? "local";
}

export async function POST(request: NextRequest) {
  if (!checkRateLimit(`restore:${getClientKey(request)}`, 40, 60_000)) {
    return NextResponse.json(
      {
        error: "You’re switching versions too quickly. Please try again in a moment."
      },
      { status: 429 }
    );
  }

  const body = (await request.json()) as { revisionId?: string };

  try {
    const project = await restoreRevision({
      revisionId: body.revisionId ?? ""
    });

    return NextResponse.json({ project });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong while loading that version.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
