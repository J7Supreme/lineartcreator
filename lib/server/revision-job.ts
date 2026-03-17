import "server-only";

import {
  completeRevision,
  failRevision,
  getRevisionById,
  updateRevisionPhase
} from "@/lib/server/project-store";
import {
  loadImagePartFromUrl,
  normalizeLineArtImage,
  saveGeneratedImage
} from "@/lib/server/asset-store";
import {
  convertToLineArt,
  deriveRevisionTitle,
  generateSourceImage
} from "@/lib/server/line-art-provider";

declare global {
  // eslint-disable-next-line no-var
  var __lineArtRevisionJobs: Set<string> | undefined;
}

const runningJobs = globalThis.__lineArtRevisionJobs ?? new Set<string>();
globalThis.__lineArtRevisionJobs = runningJobs;

export function startRevisionJob(revisionId: string) {
  if (runningJobs.has(revisionId)) {
    return;
  }

  runningJobs.add(revisionId);

  void runRevisionJob(revisionId).finally(() => {
    runningJobs.delete(revisionId);
  });
}

async function runRevisionJob(revisionId: string) {
  try {
    const { project, revision } = await getRevisionById(revisionId);

    if (!revision) {
      return;
    }

    const parentRevision = revision.parentRevisionId
      ? project.revisions.find((item) => item.id === revision.parentRevisionId) ?? null
      : null;

    let sourceImage = revision.sourceImageUrl
      ? await loadImagePartFromUrl(revision.sourceImageUrl)
      : undefined;

    if (!sourceImage) {
      const baseImage =
        parentRevision?.sourceImageUrl && revision.sourceType === "revision"
          ? await loadImagePartFromUrl(parentRevision.sourceImageUrl)
          : undefined;
      const generatedSource = await generateSourceImage({
        prompt: revision.prompt,
        baseImage
      });
      const savedSource = await saveGeneratedImage(
        "source",
        generatedSource.dataBase64,
        generatedSource.mimeType
      );

      sourceImage = {
        dataBase64: generatedSource.dataBase64,
        mimeType: generatedSource.mimeType
      };

      await updateRevisionPhase(revisionId, "generating_line_art", {
        sourceImageUrl: savedSource.url,
        modelName: generatedSource.modelName
      });
    }

    const lineArt = await convertToLineArt({
      prompt: revision.prompt,
      sourceImage
    });
    const normalizedLineArt = await normalizeLineArtImage(
      lineArt.dataBase64,
      lineArt.mimeType
    );
    const savedFinal = await saveGeneratedImage(
      "final",
      normalizedLineArt.dataBase64,
      normalizedLineArt.mimeType
    );
    const { revision: freshRevision } = await getRevisionById(revisionId);
    const sourceImageUrl =
      freshRevision?.sourceImageUrl ?? revision.sourceImageUrl ?? parentRevision?.sourceImageUrl ?? null;

    await completeRevision(revisionId, {
      title: deriveRevisionTitle(revision.prompt, revision.sourceType),
      imageUrl: savedFinal.url,
      thumbnailUrl: savedFinal.url,
      sourceImageUrl,
      modelName: lineArt.modelName,
      assistantText:
        lineArt.textResponse?.trim() || "Your line art is ready. Open it, review it, and keep iterating if needed."
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong while generating the line art.";

    await failRevision(revisionId, message);
  }
}
