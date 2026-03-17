import { NextResponse } from "next/server";

import { getCurrentProject } from "@/lib/server/project-store";

export async function GET() {
  const project = await getCurrentProject();

  return NextResponse.json({ project });
}
