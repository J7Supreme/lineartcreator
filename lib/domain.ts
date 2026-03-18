export const BASE_PATH = "/lineartcreator";

export type RevisionStatus =
  | "queued"
  | "generating_source_image"
  | "generating_line_art"
  | "ready"
  | "failed";

export type RevisionSourceType = "prompt" | "upload" | "revision";

export type Revision = {
  id: string;
  parentRevisionId: string | null;
  title: string;
  prompt: string;
  editInstruction: string | null;
  status: RevisionStatus;
  createdAt: string;
  sourceType: RevisionSourceType;
  sourceImageUrl: string | null;
  imageUrl: string;
  thumbnailUrl: string;
  modelName: string;
  jobId: string | null;
  errorMessage: string | null;
};

export type AssistantStatusPhase =
  | "queued"
  | "generating_source_image"
  | "generating_line_art"
  | "failed"
  | "complete";

export type Message =
  | {
      id: string;
      role: "assistant";
      kind: "welcome" | "status";
      text: string;
      revisionId?: string;
      phase?: AssistantStatusPhase;
      createdAt: string;
    }
  | {
      id: string;
      role: "user";
      kind: "prompt" | "upload";
      text: string;
      createdAt: string;
    }
  | {
      id: string;
      role: "assistant";
      kind: "result";
      text: string;
      revisionId: string;
      createdAt: string;
    };

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  activeRevisionId: string | null;
  revisions: Revision[];
  messages: Message[];
};

export type CreateRevisionInput = {
  prompt?: string;
  parentRevisionId?: string | null;
  sourceType?: RevisionSourceType;
  uploadedImageUrl?: string | null;
};

export type RestoreRevisionInput = {
  revisionId: string;
};
