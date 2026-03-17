import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { nanoid } from "nanoid";
import sharp from "sharp";

const ASSET_ROOT = path.join(process.cwd(), "data", "assets");

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

async function ensureAssetRoot() {
  await mkdir(path.join(ASSET_ROOT, "uploads"), { recursive: true });
  await mkdir(path.join(ASSET_ROOT, "source"), { recursive: true });
  await mkdir(path.join(ASSET_ROOT, "final"), { recursive: true });
}

function createRelativePath(bucket: AssetBucket, mimeType: string) {
  const extension = getExtension(mimeType);
  const datePrefix = new Date().toISOString().slice(0, 10);
  return `${bucket}/${datePrefix}/${nanoid(12)}.${extension}`;
}

function toAssetUrl(relativePath: string) {
  return `/api/assets/${relativePath}`;
}

export async function saveGeneratedImage(
  bucket: AssetBucket,
  base64Data: string,
  mimeType: string
): Promise<SavedAsset> {
  await ensureAssetRoot();

  const relativePath = createRelativePath(bucket, mimeType);
  const absolutePath = path.join(ASSET_ROOT, relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(base64Data, "base64"));

  return {
    mimeType,
    relativePath,
    url: toAssetUrl(relativePath)
  };
}

export async function saveUploadedFile(file: File): Promise<SavedAsset> {
  const mimeType = file.type || "image/png";

  if (!mimeType.startsWith("image/")) {
    throw new Error("Only image uploads are supported.");
  }

  await ensureAssetRoot();

  const relativePath = createRelativePath("uploads", mimeType);
  const absolutePath = path.join(ASSET_ROOT, relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return {
    mimeType,
    relativePath,
    url: toAssetUrl(relativePath)
  };
}

export async function readAsset(relativePath: string) {
  const absolutePath = path.resolve(ASSET_ROOT, relativePath);

  if (!absolutePath.startsWith(ASSET_ROOT)) {
    throw new Error("Invalid asset path.");
  }

  const buffer = await readFile(absolutePath);
  const extension = path.extname(relativePath).replace(".", "");
  const mimeType =
    Object.entries(MIME_EXTENSIONS).find(([, value]) => value === extension)?.[0] ?? "image/png";

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
