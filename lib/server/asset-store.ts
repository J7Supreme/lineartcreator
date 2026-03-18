import "server-only";

import path from "node:path";

import { getStore } from "@netlify/blobs";
import { nanoid } from "nanoid";
import sharp from "sharp";

type AssetBucket = "uploads" | "source" | "final";

type SavedAsset = {
  mimeType: string;
  relativePath: string;
  url: string;
};

type NormalizedImage = {
  dataBase64: string;
  mimeType: string;
};

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg"
};

function getExtension(mimeType: string) {
  return MIME_EXTENSIONS[mimeType] ?? "png";
}

function createRelativePath(bucket: AssetBucket, mimeType: string) {
  const extension = getExtension(mimeType);
  const datePrefix = new Date().toISOString().slice(0, 10);
  return `${bucket}/${datePrefix}/${nanoid(12)}.${extension}`;
}

function toAssetUrl(relativePath: string) {
  return `/api/assets/${relativePath}`;
}

function isValidRelativePath(relativePath: string) {
  const normalized = path.normalize(relativePath);
  return !normalized.startsWith("..") && !path.isAbsolute(normalized);
}

export async function saveGeneratedImage(
  bucket: AssetBucket,
  base64Data: string,
  mimeType: string
): Promise<SavedAsset> {
  const store = getStore("assets");
  const relativePath = createRelativePath(bucket, mimeType);

  await store.set(relativePath, Buffer.from(base64Data, "base64").buffer as ArrayBuffer, {
    metadata: { mimeType }
  });

  return { mimeType, relativePath, url: toAssetUrl(relativePath) };
}

export async function saveUploadedFile(file: File): Promise<SavedAsset> {
  const mimeType = file.type || "image/png";

  if (!mimeType.startsWith("image/")) {
    throw new Error("Only image uploads are supported.");
  }

  const store = getStore("assets");
  const relativePath = createRelativePath("uploads", mimeType);

  await store.set(relativePath, await file.arrayBuffer(), {
    metadata: { mimeType }
  });

  return { mimeType, relativePath, url: toAssetUrl(relativePath) };
}

export async function readAsset(relativePath: string) {
  if (!isValidRelativePath(relativePath)) {
    throw new Error("Invalid asset path.");
  }

  const store = getStore("assets");
  const result = await store.getWithMetadata(relativePath, { type: "arrayBuffer" });

  if (!result) {
    throw new Error("Asset not found.");
  }

  const buffer = Buffer.from(result.data as ArrayBuffer);
  const extension = path.extname(relativePath).replace(".", "");
  const mimeType =
    (result.metadata?.mimeType as string | undefined) ??
    Object.entries(MIME_EXTENSIONS).find(([, value]) => value === extension)?.[0] ??
    "image/png";

  return { buffer, mimeType };
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+)(;base64)?,(.*)$/);

  if (!match) {
    throw new Error("Unsupported data URL.");
  }

  const [, mimeType, base64Marker, payload] = match;
  const buffer = base64Marker
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");

  return {
    mimeType,
    dataBase64: buffer.toString("base64")
  };
}

export async function loadImagePartFromUrl(imageUrl: string) {
  if (imageUrl.startsWith("/api/assets/")) {
    const relativePath = imageUrl.replace(/^\/api\/assets\//, "");
    const asset = await readAsset(relativePath);

    return {
      mimeType: asset.mimeType,
      dataBase64: asset.buffer.toString("base64")
    };
  }

  if (imageUrl.startsWith("data:")) {
    return decodeDataUrl(imageUrl);
  }

  throw new Error("Unsupported image source.");
}

export async function normalizeLineArtImage(
  dataBase64: string,
  mimeType: string
): Promise<NormalizedImage> {
  if (mimeType === "image/svg+xml") {
    return {
      dataBase64,
      mimeType
    };
  }

  const normalized = await sharp(Buffer.from(dataBase64, "base64"))
    .flatten({ background: "#ffffff" })
    .grayscale()
    .threshold(235, { grayscale: true })
    .resize({
      width: 2480,
      height: 3508,
      fit: "contain",
      background: "#ffffff",
      position: "center"
    })
    .png()
    .toBuffer();

  return {
    dataBase64: normalized.toString("base64"),
    mimeType: "image/png"
  };
}
