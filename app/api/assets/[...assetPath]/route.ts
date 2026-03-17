import { NextResponse } from "next/server";

import { readAsset } from "@/lib/server/asset-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetPath: string[] }> }
) {
  try {
    const { assetPath } = await params;
    const relativePath = assetPath.join("/");
    const asset = await readAsset(relativePath);

    return new NextResponse(asset.buffer, {
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }
}
