import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { PROJECT_COOKIE_NAME, resetProject } from "@/lib/server/project-store";

export async function POST() {
  try {
    const projectId = `project-${nanoid(12)}`;
    const project = await resetProject(projectId);
    const response = NextResponse.json({ project });

    response.cookies.set(PROJECT_COOKIE_NAME, projectId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30
    });

    return response;
  } catch (error) {
    console.error("Error in /api/project/reset:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Internal Server Error" 
    }, { status: 500 });
  }
}
