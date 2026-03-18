import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { nanoid } from "nanoid";

const PROJECT_COOKIE_NAME = "line_art_project_id";

export function middleware(request: NextRequest) {
  const existingProjectId = request.cookies.get(PROJECT_COOKIE_NAME)?.value?.trim();

  if (existingProjectId) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set(PROJECT_COOKIE_NAME, `project-${nanoid(12)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
