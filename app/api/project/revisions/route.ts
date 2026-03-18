import { NextRequest, NextResponse } from "next/server";

import { saveUploadedFile } from "@/lib/server/asset-store";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createPendingRevision } from "@/lib/server/project-store";
import { startRevisionJob } from "@/lib/server/revision-job";

export const runtime = "nodejs";

function getClientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for") ?? "local";
}

async function parseRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    const prompt = `${formData.get("prompt") ?? ""}`.trim();
    const parentRevisionId = `${formData.get("parentRevisionId") ?? ""}`.trim() || null;

    if (file instanceof File && file.size > 0) {
      const uploaded = await saveUploadedFile(file);

      return {
        prompt,
        parentRevisionId,
        uploadedImageUrl: uploaded.url
      };
    }

    return {
      prompt,
      parentRevisionId,
      uploadedImageUrl: null
    };
  }

  const body = (await request.json().catch(() => ({}))) as {
    prompt?: string;
    parentRevisionId?: string | null;
  };

  return {
    prompt: body.prompt?.trim() ?? "",
    parentRevisionId: body.parentRevisionId ?? null,
    uploadedImageUrl: null
  };
}

export async function POST(request: NextRequest) {
  if (!checkRateLimit(`create:${getClientKey(request)}`, 20, 60_000)) {
    return NextResponse.json(
      {
        error: "You’re sending requests too quickly. Please wait a moment and try again."
      },
      { status: 429 }
    );
  }

  try {
    const input = await parseRequest(request);
    const { project, revision } = await createPendingRevision(input);

    startRevisionJob(revision.id, project.id);

    return NextResponse.json({
      project,
      revisionId: revision.id,
      jobId: revision.jobId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong while creating the drawing.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
