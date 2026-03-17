import { NextResponse } from "next/server";

import { resetProject } from "@/lib/server/project-store";

export async function POST() {
  const project = await resetProject();
  return NextResponse.json({ project });
}
