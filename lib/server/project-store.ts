import "server-only";

import { getStore } from "@netlify/blobs";
import { nanoid } from "nanoid";

import type {
  AssistantStatusPhase,
  CreateRevisionInput,
  Message,
  Project,
  RestoreRevisionInput,
  Revision,
  RevisionSourceType,
  RevisionStatus
} from "@/lib/domain";
import { createLineArtDataUrl } from "@/lib/line-art";

const PROJECT_KEY = "data";

let writeChain = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

function createSeedProject(): Project {
  const createdAt = nowIso();

  return {
    id: "project-default",
    name: "My drawing",
    createdAt,
    updatedAt: createdAt,
    activeRevisionId: null,
    revisions: [],
    messages: []
  };
}

function normalizeStatus(status: unknown): RevisionStatus {
  switch (status) {
    case "queued":
    case "generating_source_image":
    case "generating_line_art":
    case "ready":
    case "failed":
      return status;
    case "generating":
      return "generating_line_art";
    default:
      return "ready";
  }
}

function normalizeRevision(revision: Partial<Revision>): Revision {
  const prompt = revision.prompt ?? "";
  const sourceType = revision.sourceType ?? "prompt";
  const imageUrl = revision.imageUrl ?? createLineArtDataUrl("garden");

  return {
    id: revision.id ?? `rev-${nanoid(10)}`,
    parentRevisionId: revision.parentRevisionId ?? null,
    title: revision.title ?? "Untitled drawing",
    prompt,
    editInstruction: revision.editInstruction ?? (prompt || null),
    status: normalizeStatus(revision.status),
    createdAt: revision.createdAt ?? nowIso(),
    sourceType,
    sourceImageUrl: revision.sourceImageUrl ?? null,
    imageUrl,
    thumbnailUrl: revision.thumbnailUrl ?? imageUrl,
    modelName: revision.modelName ?? "unknown",
    jobId: revision.jobId ?? null,
    errorMessage: revision.errorMessage ?? null
  };
}

function normalizeStatusPhase(phase: unknown): AssistantStatusPhase | undefined {
  switch (phase) {
    case "queued":
    case "generating_source_image":
    case "generating_line_art":
    case "failed":
    case "complete":
      return phase;
    default:
      return undefined;
  }
}

function normalizeMessage(message: Partial<Message>): Message {
  if (message.role === "assistant" && message.kind === "result" && message.revisionId) {
    return {
      id: message.id ?? `m-${nanoid(10)}`,
      role: "assistant",
      kind: "result",
      text: message.text ?? "Your image is ready.",
      revisionId: message.revisionId,
      createdAt: message.createdAt ?? nowIso()
    };
  }

  if (message.role === "assistant") {
    const phase = "phase" in message ? normalizeStatusPhase(message.phase) : undefined;

    return {
      id: message.id ?? `m-${nanoid(10)}`,
      role: "assistant",
      kind: message.kind === "welcome" ? "welcome" : "status",
      text: message.text ?? "",
      revisionId: message.revisionId,
      phase,
      createdAt: message.createdAt ?? nowIso()
    };
  }

  return {
    id: message.id ?? `m-${nanoid(10)}`,
    role: "user",
    kind: message.kind === "upload" ? "upload" : "prompt",
    text: message.text ?? "",
    createdAt: message.createdAt ?? nowIso()
  };
}

function normalizeProject(project: Partial<Project>): Project {
  return {
    id: project.id ?? "project-default",
    name: project.name ?? "My drawing",
    createdAt: project.createdAt ?? nowIso(),
    updatedAt: project.updatedAt ?? nowIso(),
    activeRevisionId: project.activeRevisionId ?? null,
    revisions: (project.revisions ?? []).map(normalizeRevision),
    messages: (project.messages ?? []).map(normalizeMessage)
  };
}

async function readProjectUnlocked(): Promise<Project> {
  const store = getStore("project");
  const data = await store.get(PROJECT_KEY, { type: "json" });

  if (!data) {
    const seed = createSeedProject();
    await writeProject(seed);
    return seed;
  }

  return normalizeProject(data as Partial<Project>);
}

async function writeProject(project: Project) {
  const store = getStore("project");
  await store.setJSON(PROJECT_KEY, project);
}

async function withWriteLock<T>(operation: () => Promise<T>) {
  const next = writeChain.then(operation, operation);
  writeChain = next.then(
    () => undefined,
    () => undefined
  );

  return next;
}

function getPhaseText(phase: AssistantStatusPhase) {
  switch (phase) {
    case "queued":
      return "Preparing your request...";
    case "generating_source_image":
      return "Generating the source image...";
    case "generating_line_art":
      return "Generating the line art...";
    case "failed":
      return "This generation failed.";
    case "complete":
      return "Complete";
  }
}

function upsertStatusMessage(
  messages: Message[],
  revisionId: string,
  phase: AssistantStatusPhase,
  text: string
): Message[] {
  const now = nowIso();
  const existingIndex = messages.findIndex(
    (message) =>
      message.role === "assistant" &&
      message.kind === "status" &&
      message.revisionId === revisionId
  );

  if (existingIndex === -1) {
    const statusMessage: Message = {
      id: `m-${nanoid(10)}`,
      role: "assistant",
      kind: "status",
      text,
      revisionId,
      phase,
      createdAt: now
    };

    return [
      ...messages,
      statusMessage
    ];
  }

  return messages.map((message, index): Message => {
    if (index !== existingIndex || message.role !== "assistant" || message.kind !== "status") {
      return message;
    }

    return {
      ...message,
      text,
      phase,
      createdAt: now
    };
  });
}

function deriveTitle(prompt: string, sourceType: RevisionSourceType) {
  const raw = prompt.trim().replace(/[.!?]+$/, "");

  if (!raw) {
    return sourceType === "upload" ? "Uploaded image" : "New drawing";
  }

  if (raw.length <= 40) {
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  const truncated = raw.slice(0, 40);
  const lastSpace = truncated.lastIndexOf(" ");

  return `${(lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated).trim()}…`;
}

function isWorkingStatus(status: RevisionStatus) {
  return (
    status === "queued" ||
    status === "generating_source_image" ||
    status === "generating_line_art"
  );
}

export async function getCurrentProject(): Promise<Project> {
  return readProjectUnlocked();
}

export async function getRevisionById(revisionId: string) {
  const project = await getCurrentProject();
  const revision = project.revisions.find((item) => item.id === revisionId) ?? null;

  return { project, revision };
}

export async function createPendingRevision(input: CreateRevisionInput) {
  const prompt = input.prompt?.trim() ?? "";
  const hasUpload = Boolean(input.uploadedImageUrl);

  if (!prompt && !hasUpload) {
    throw new Error("Please enter a description or upload an image.");
  }

  if (prompt.length > 600) {
    throw new Error("Please keep your message under 600 characters.");
  }

  return withWriteLock(async () => {
    const project = await readProjectUnlocked();
    const parentRevisionId = input.parentRevisionId ?? project.activeRevisionId;
    const parentRevision = parentRevisionId
      ? project.revisions.find((item) => item.id === parentRevisionId) ?? null
      : null;
    const sourceType: RevisionSourceType = hasUpload
      ? "upload"
      : parentRevision?.sourceImageUrl
        ? "revision"
        : "prompt";
    const status: RevisionStatus = hasUpload ? "generating_line_art" : "generating_source_image";
    const phase: AssistantStatusPhase = hasUpload
      ? "generating_line_art"
      : "generating_source_image";
    const now = nowIso();
    const revisionId = `rev-${nanoid(10)}`;
    const jobId = `job-${nanoid(10)}`;
    const title = deriveTitle(prompt, sourceType);
    const userText = hasUpload ? prompt || "Uploaded an image to convert into line art." : prompt;
    const revision: Revision = {
      id: revisionId,
      parentRevisionId,
      title,
      prompt,
      editInstruction: prompt || null,
      status,
      createdAt: now,
      sourceType,
      sourceImageUrl: input.uploadedImageUrl ?? null,
      imageUrl: createLineArtDataUrl("loading"),
      thumbnailUrl: createLineArtDataUrl("loading"),
      modelName: "pending",
      jobId,
      errorMessage: null
    };
    const nextProject: Project = {
      ...project,
      activeRevisionId: revision.id,
      updatedAt: now,
      revisions: [revision, ...project.revisions],
      messages: [
        ...project.messages,
        {
          id: `m-${nanoid(10)}`,
          role: "user",
          kind: hasUpload ? "upload" : "prompt",
          text: userText,
          createdAt: now
        },
        ...upsertStatusMessage([], revision.id, phase, getPhaseText(phase))
      ]
    };

    await writeProject(nextProject);

    return { project: nextProject, revision };
  });
}

export async function updateRevisionPhase(
  revisionId: string,
  phase: Exclude<AssistantStatusPhase, "complete">,
  updates: Partial<Revision> = {}
) {
  return withWriteLock(async () => {
    const project = await readProjectUnlocked();
    const revision = project.revisions.find((item) => item.id === revisionId);

    if (!revision) {
      throw new Error("That revision could not be found.");
    }

    const nextRevision: Revision = {
      ...revision,
      ...updates,
      status: phase,
      errorMessage: phase === "failed" ? updates.errorMessage ?? revision.errorMessage : null
    };

    const nextProject: Project = {
      ...project,
      updatedAt: nowIso(),
      revisions: project.revisions.map((item) => (item.id === revisionId ? nextRevision : item)),
      messages: upsertStatusMessage(project.messages, revisionId, phase, getPhaseText(phase))
    };

    await writeProject(nextProject);

    return nextProject;
  });
}

export async function completeRevision(
  revisionId: string,
  updates: Pick<Revision, "title" | "imageUrl" | "thumbnailUrl" | "modelName" | "sourceImageUrl"> & {
    assistantText: string;
  }
) {
  return withWriteLock(async () => {
    const project = await readProjectUnlocked();
    const revision = project.revisions.find((item) => item.id === revisionId);

    if (!revision) {
      throw new Error("That revision could not be found.");
    }

    const nextRevision: Revision = {
      ...revision,
      title: updates.title,
      imageUrl: updates.imageUrl,
      thumbnailUrl: updates.thumbnailUrl,
      modelName: updates.modelName,
      sourceImageUrl: updates.sourceImageUrl,
      status: "ready",
      errorMessage: null
    };
    const nextProject: Project = {
      ...project,
      activeRevisionId: revisionId,
      updatedAt: nowIso(),
      revisions: project.revisions.map((item) => (item.id === revisionId ? nextRevision : item)),
      messages: upsertStatusMessage(project.messages, revisionId, "complete", updates.assistantText)
    };

    await writeProject(nextProject);

    return nextProject;
  });
}

export async function failRevision(revisionId: string, errorMessage: string) {
  return withWriteLock(async () => {
    const project = await readProjectUnlocked();
    const revision = project.revisions.find((item) => item.id === revisionId);

    if (!revision) {
      throw new Error("That revision could not be found.");
    }

    const nextRevision: Revision = {
      ...revision,
      status: "failed",
      errorMessage
    };
    const nextProject: Project = {
      ...project,
      updatedAt: nowIso(),
      revisions: project.revisions.map((item) => (item.id === revisionId ? nextRevision : item)),
      messages: upsertStatusMessage(project.messages, revisionId, "failed", errorMessage)
    };

    await writeProject(nextProject);

    return nextProject;
  });
}

export async function restoreRevision(input: RestoreRevisionInput): Promise<Project> {
  return withWriteLock(async () => {
    const project = await readProjectUnlocked();
    const revision = project.revisions.find((item) => item.id === input.revisionId);

    if (!revision) {
      throw new Error("That version could not be found.");
    }

    const nextProject: Project = {
      ...project,
      activeRevisionId: revision.id,
      updatedAt: nowIso()
    };

    await writeProject(nextProject);

    return nextProject;
  });
}

export async function resetProject(): Promise<Project> {
  const fresh = createSeedProject();
  await withWriteLock(async () => {
    await writeProject(fresh);
  });
  return fresh;
}

export async function retryRevision(revisionId: string) {
  return withWriteLock(async () => {
    const project = await readProjectUnlocked();
    const revision = project.revisions.find((item) => item.id === revisionId);

    if (!revision) {
      throw new Error("That revision could not be found.");
    }

    if (isWorkingStatus(revision.status)) {
      return { project, revision };
    }

    const now = nowIso();
    const nextStatus: RevisionStatus =
      revision.sourceType === "upload" ? "generating_line_art" : "generating_source_image";
    const phase: AssistantStatusPhase =
      revision.sourceType === "upload" ? "generating_line_art" : "generating_source_image";
    const nextRevision: Revision = {
      ...revision,
      status: nextStatus,
      jobId: `job-${nanoid(10)}`,
      imageUrl: createLineArtDataUrl("loading"),
      thumbnailUrl: createLineArtDataUrl("loading"),
      errorMessage: null
    };
    const nextProject: Project = {
      ...project,
      activeRevisionId: revision.id,
      updatedAt: now,
      revisions: project.revisions.map((item) => (item.id === revisionId ? nextRevision : item)),
      messages: upsertStatusMessage(project.messages, revisionId, phase, getPhaseText(phase))
    };

    await writeProject(nextProject);

    return { project: nextProject, revision: nextRevision };
  });
}

export function formatRevisionTime(iso: string) {
  return formatTime(iso);
}
