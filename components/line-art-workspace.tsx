"use client";

import Image from "next/image";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";

import type { AssistantStatusPhase, Project, Revision, RevisionStatus } from "@/lib/domain";
import { createLineArtDataUrl } from "@/lib/line-art";

import styles from "./line-art-workspace.module.css";

type ViewerState = {
  open: boolean;
  revisionId: string | null;
};

type LineArtWorkspaceProps = {
  initialProject: Project;
};

const APP_VERSION = "v0.9";

export function LineArtWorkspace({ initialProject }: LineArtWorkspaceProps) {
  const [project, setProject] = useState<Project>(initialProject);
  const [draft, setDraft] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRestoring, startRestoreTransition] = useTransition();
  const [viewerState, setViewerState] = useState<ViewerState>({
    open: false,
    revisionId: null
  });
  const [isViewingRevisions, setIsViewingRevisions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasInitializedProjectRef = useRef(false);

  const isInitial = project.messages.length === 0;
  const activeRevision = useMemo(
    () =>
      project.revisions.find((revision) => revision.id === project.activeRevisionId) ??
      project.revisions[0] ??
      null,
    [project]
  );
  const activeRevisionId = activeRevision?.id ?? null;
  const activeRevisionStatus = activeRevision?.status ?? null;
  const shouldPollActiveRevision =
    Boolean(activeRevisionId) &&
    Boolean(activeRevisionStatus) &&
    isWorkingStatus(activeRevisionStatus) &&
    !activeRevisionId.startsWith("temp-");
  const isWorking = activeRevision ? isWorkingStatus(activeRevision.status) : false;
  const isBusy = isSubmitting || isWorking;

  useEffect(() => {
    if (hasInitializedProjectRef.current) {
      return;
    }

    hasInitializedProjectRef.current = true;

    let cancelled = false;

    const initializeProject = async () => {
      try {
        const response = await fetch("/api/project/reset", {
          method: "POST"
        });
        const payload = (await response.json()) as { project?: Project; error?: string };

        if (!response.ok || !payload.project) {
          throw new Error(payload.error ?? "Unable to start a fresh project.");
        }

        if (!cancelled) {
          setProject(payload.project);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Unable to start a fresh project."
          );
        }
      }
    };

    void initializeProject();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!shouldPollActiveRevision || !activeRevisionId) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      try {
        const response = await fetch(`/api/project/revisions/${activeRevisionId}`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as {
          project?: Project;
          revision?: Revision;
          error?: string;
        };

        if (!response.ok || !payload.project || !payload.revision) {
          throw new Error(payload.error ?? "Unable to refresh the current generation.");
        }

        if (cancelled) {
          return;
        }

        setProject(payload.project);
        if (payload.revision.status === "failed") {
          setErrorMessage(payload.revision.errorMessage ?? "Generation failed.");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Unable to refresh the current generation."
          );
        }
      } finally {
        if (!cancelled) {
          setIsSubmitting(false);
        }
      }
    };

    void tick();

    const intervalId = window.setInterval(() => {
      void tick();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeRevisionId, shouldPollActiveRevision]);


  function handleOpenViewer(revisionId: string) {
    setViewerState({ open: true, revisionId });
  }

  function handleCloseViewer() {
    setViewerState({ open: false, revisionId: null });
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setSelectedFile(file);
  }

  function clearSelectedFile() {
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleDownload(revision: Revision | null) {
    if (!revision || revision.status !== "ready") return;

    const image = new window.Image();
    image.src = revision.imageUrl;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to render image for download."));
    });

    const canvas = document.createElement("canvas");
    canvas.width = 2480;
    canvas.height = 3508;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas is not available in this browser.");
    }

    context.fillStyle = "#fdfaf2";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const imageRatio = image.width / image.height;
    const canvasRatio = canvas.width / canvas.height;
    const drawWidth =
      imageRatio > canvasRatio ? canvas.width : Math.round(canvas.height * imageRatio);
    const drawHeight =
      imageRatio > canvasRatio ? Math.round(canvas.width / imageRatio) : canvas.height;
    const offsetX = Math.round((canvas.width - drawWidth) / 2);
    const offsetY = Math.round((canvas.height - drawHeight) / 2);

    context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${revision.title.toLowerCase().replace(/\s+/g, "-")}.png`;
    link.click();
  }

  function handleSelectRevision(revisionId: string) {
    if (revisionId === project.activeRevisionId) {
      return;
    }

    const previousActiveRevisionId = project.activeRevisionId;

    setErrorMessage(null);
    startTransition(() => {
      setProject((current) => ({ ...current, activeRevisionId: revisionId }));
    });

    startRestoreTransition(async () => {
      try {
        const response = await fetch("/api/project/restore", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ revisionId })
        });
        const payload = (await response.json()) as { project?: Project; error?: string };

        if (!response.ok || !payload.project) {
          throw new Error(payload.error ?? "Unable to open that version.");
        }

        setProject(payload.project);
        setIsViewingRevisions(false);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to open that version.");
        setProject((current) => ({ ...current, activeRevisionId: previousActiveRevisionId }));
      }
    });
  }

  async function handleRetry(revision: Revision | null) {
    if (!revision || isBusy) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/project/revisions/${revision.id}/retry`, {
        method: "POST"
      });
      const payload = (await response.json()) as { project?: Project; error?: string };

      if (!response.ok || !payload.project) {
        throw new Error(payload.error ?? "Unable to retry this revision.");
      }

      setProject(payload.project);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to retry this revision.");
      setIsSubmitting(false);
    }
  }

  async function handleStartNew() {
    if (isBusy) return;

    setErrorMessage(null);
    setDraft("");
    clearSelectedFile();

    try {
      const response = await fetch("/api/project/reset", { method: "POST" });
      const payload = (await response.json()) as { project?: Project; error?: string };

      if (!response.ok || !payload.project) {
        throw new Error(payload.error ?? "Unable to reset the project.");
      }

      setProject(payload.project);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to reset the project.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    const prompt = draft.trim();

    if (!prompt && !selectedFile) {
      setErrorMessage("Please describe what you want or upload an image.");
      return;
    }

    const previousProject = project;
    const now = new Date().toISOString();
    const tempRevisionId = `temp-${Math.random().toString(36).slice(2, 11)}`;
    const isUpload = Boolean(selectedFile);
    const phase: AssistantStatusPhase = isUpload
      ? "generating_line_art"
      : "generating_source_image";
    const optimisticProject: Project = {
      ...project,
      activeRevisionId: tempRevisionId,
      updatedAt: now,
      revisions: [
        {
          id: tempRevisionId,
          parentRevisionId: project.activeRevisionId,
          title: isUpload ? "Converting upload..." : "Generating drawing...",
          prompt,
          editInstruction: prompt || null,
          status: phase,
          createdAt: now,
          sourceType: isUpload ? "upload" : "prompt",
          sourceImageUrl: null,
          imageUrl: createLineArtDataUrl("loading"),
          thumbnailUrl: createLineArtDataUrl("loading"),
          modelName: "pending",
          jobId: null,
          errorMessage: null
        },
        ...project.revisions
      ],
      messages: [
        ...project.messages,
        {
          id: `temp-user-${Math.random().toString(36).slice(2, 11)}`,
          role: "user",
          kind: isUpload ? "upload" : "prompt",
          text: isUpload ? prompt || "Uploaded an image to convert into line art." : prompt,
          createdAt: now
        },
        {
          id: `temp-status-${Math.random().toString(36).slice(2, 11)}`,
          role: "assistant",
          kind: "status",
          text: getPhaseLabel(phase),
          revisionId: tempRevisionId,
          phase,
          createdAt: now
        }
      ]
    };

    const formData = new FormData();
    formData.set("prompt", prompt);

    if (project.activeRevisionId) {
      formData.set("parentRevisionId", project.activeRevisionId);
    }

    if (selectedFile) {
      formData.set("file", selectedFile);
    }

    setErrorMessage(null);
    setDraft("");
    setIsSubmitting(true);
    setProject(optimisticProject);

    try {
      const response = await fetch("/api/project/revisions", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as { project?: Project; error?: string };

      if (!response.ok || !payload.project) {
        throw new Error(payload.error ?? "Unable to update the drawing.");
      }

      clearSelectedFile();
      setProject(payload.project);
    } catch (error) {
      setProject(previousProject);
      setDraft(prompt);
      setErrorMessage(error instanceof Error ? error.message : "Unable to update the drawing.");
      setIsSubmitting(false);
    }
  }

  const viewerRevision =
    project.revisions.find((revision) => revision.id === viewerState.revisionId) ?? activeRevision;

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1>Line Art Creator</h1>
          <div className={styles.heroVersion}>J7Supreme {APP_VERSION}</div>
        </div>
        <Image
          src="/logo.png"
          alt="J7 logo"
          width={52}
          height={52}
          className={styles.heroLogo}
        />
      </section>

      <section className={styles.workspace}>
        <div className={styles.chatPanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Describe your drawing</h2>
              <p>Start with text, or upload an image and convert it to line art.</p>
            </div>
          </div>

          {errorMessage ? <div className={styles.errorBanner}>{errorMessage}</div> : null}

          {isInitial ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>
                <svg
                  width="52"
                  height="52"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </div>
              <h3 className={styles.emptyStateTitle}>Start with a description</h3>
              <p className={styles.emptyStateBody}>
                Describe any scene you&apos;d like as a printable line art coloring page, or
                upload an existing image to convert.
              </p>
            </div>
          ) : (
            <div className={styles.messageList}>
              {project.messages.map((message) => {
                const messageRevision =
                  message.kind === "result" || message.kind === "status"
                    ? project.revisions.find((revision) => revision.id === message.revisionId)
                    : undefined;

                return (
                  <article
                    key={message.id}
                    className={message.role === "user" ? styles.userMessage : styles.assistantMessage}
                  >
                    <div className={styles.messageBubble}>
                      <p>{message.text}</p>

                      {message.kind === "result" && messageRevision ? (
                        <button
                          className={styles.inlineImageButton}
                          type="button"
                          onClick={() => {
                            handleSelectRevision(messageRevision.id);
                            handleOpenViewer(messageRevision.id);
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={messageRevision.title}
                            className={styles.inlineImage}
                            src={messageRevision.thumbnailUrl}
                          />
                          <span>Open full image</span>
                        </button>
                      ) : null}

                      {message.kind === "status" ? (
                        <div className={styles.generatingCard}>
                          {message.phase === "failed" || message.phase === "complete" ? null : (
                            <span className={styles.pulseDot} />
                          )}
                          <strong>{getPhaseLabel(message.phase)}</strong>
                        </div>
                      ) : null}

                      {message.kind === "status" &&
                      message.phase === "complete" &&
                      messageRevision &&
                      messageRevision.status === "ready" ? (
                        <button
                          className={styles.inlineImageButton}
                          type="button"
                          onClick={() => {
                            handleSelectRevision(messageRevision.id);
                            handleOpenViewer(messageRevision.id);
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={messageRevision.title}
                            className={styles.inlineImage}
                            src={messageRevision.thumbnailUrl}
                          />
                          <span>Open full image</span>
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}


          <form className={styles.composer} onSubmit={handleSubmit}>
            <textarea
              id="prompt"
              name="prompt"
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                isInitial
                  ? "Example: A cat napping in a sunny garden with thick outlines."
                  : "Example: Make the cat bigger, remove the fence, and keep the thick outlines."
              }
              rows={3}
              value={draft}
              disabled={isBusy}
            />

            {selectedFile ? (
              <div className={styles.selectedFilePill}>
                <span>{selectedFile.name}</span>
                <button
                  className={styles.clearFileButton}
                  type="button"
                  onClick={clearSelectedFile}
                  disabled={isBusy}
                >
                  ×
                </button>
              </div>
            ) : null}

            <div className={styles.uploadRow}>
              <input
                ref={fileInputRef}
                className={styles.fileInput}
                id="image-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                disabled={isBusy}
              />
            </div>

            <div className={styles.composerActions}>
              {!isInitial ? (
                <button
                  className={styles.iconButton}
                  type="button"
                  onClick={() => void handleStartNew()}
                  disabled={isBusy}
                  aria-label="Start new drawing"
                  title="Start new drawing"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              ) : null}
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
              >
                Upload
              </button>
              <button className={styles.primaryComposerButton} type="submit" disabled={isBusy}>
                {getSubmitLabel(isBusy, Boolean(selectedFile), activeRevision?.status)}
              </button>
            </div>
          </form>
        </div>

        <aside className={styles.previewPanel}>
          {isViewingRevisions ? (
            <div className={styles.revisionView}>
              <div className={styles.previewHeader}>
                <div>
                  <h2>Earlier versions</h2>
                  <p>Pick any version to compare or go back to it.</p>
                </div>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setIsViewingRevisions(false)}
                >
                  Back ✕
                </button>
              </div>

              <div className={styles.revisionListWide}>
                {project.revisions.length === 0 ? (
                  <p className={styles.revisionEmpty}>
                    No versions yet, create your first drawing to get started.
                  </p>
                ) : null}
                {project.revisions.map((revision) => (
                  <button
                    key={revision.id}
                    className={
                      revision.id === project.activeRevisionId
                        ? styles.revisionCardActive
                        : styles.revisionCard
                    }
                    type="button"
                    onClick={() => handleSelectRevision(revision.id)}
                    disabled={isRestoring}
                  >
                    <div className={styles.revisionThumbWrap}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt={revision.title} className={styles.revisionThumb} src={revision.thumbnailUrl} />
                    </div>
                    <div className={styles.revisionCopy}>
                      <strong>{revision.title}</strong>
                      <span>{getRevisionMetaLabel(revision)}</span>
                      <p>{revision.prompt || "Uploaded image"}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className={styles.previewHeader}>
                <div>
                  <h2>Your drawing</h2>
                  <p>The latest version, download when it looks right.</p>
                </div>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => activeRevision && handleOpenViewer(activeRevision.id)}
                  disabled={!activeRevision}
                >
                  Expand ↗
                </button>
              </div>

              <div className={styles.previewBody}>
                {activeRevision ? (
                  <>
                    <div className={styles.paperFrameWrap}>
                      <div className={styles.paperFrame}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt={activeRevision.title}
                          className={styles.previewImage}
                          src={activeRevision.imageUrl}
                        />
                      </div>
                    </div>

                    <div className={styles.previewMeta}>
                      <h3>{activeRevision.title}</h3>
                      <div className={styles.metaPills}>
                        <span>{getStatusLabel(activeRevision.status)}</span>
                        <span>{formatTime(activeRevision.createdAt)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={styles.paperFrameWrap}>
                    <div className={`${styles.paperFrame} ${styles.paperFrameEmpty}`}>
                      <div className={styles.previewEmpty}>
                        <svg
                          width="44"
                          height="44"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M3 9h18M9 21V9" />
                        </svg>
                        <p>Your drawing will appear here</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.previewFooterMinimal}>
                {activeRevision ? (
                  <div className={styles.previewDownloadRow}>
                    {activeRevision.status === "failed" ? (
                      <button
                        className={styles.secondaryButton}
                        type="button"
                        onClick={() => void handleRetry(activeRevision)}
                        disabled={isBusy}
                      >
                        Retry
                      </button>
                    ) : null}
                    <button
                      className={styles.downloadButton}
                      type="button"
                      onClick={() => void handleDownload(activeRevision)}
                      disabled={activeRevision.status !== "ready"}
                    >
                      Download PNG
                    </button>
                  </div>
                ) : null}

                <button
                  className={styles.revisionEntryPoint}
                  type="button"
                  onClick={() => setIsViewingRevisions(true)}
                >
                  <span>Earlier versions</span>
                  <div className={styles.revisionPills}>
                    <span className={styles.revisionCount}>{project.revisions.length}</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </button>
              </div>
            </>
          )}
        </aside>
      </section>

      {viewerState.open && viewerRevision ? (
        <div className={styles.viewer} role="dialog" aria-modal="true">
          <button
            aria-label="Close image viewer"
            className={styles.viewerBackdrop}
            type="button"
            onClick={handleCloseViewer}
          />

          <div className={styles.viewerPanel}>
            <div className={styles.viewerHeader}>
              <div>
                <h2>{viewerRevision.title}</h2>
              </div>
              <button className={`${styles.secondaryButton} ${styles.viewerCloseButton}`} type="button" onClick={handleCloseViewer} aria-label="Close">
                <span className={styles.viewerCloseLabel}>Close ✕</span>
                <span className={styles.viewerCloseIcon} aria-hidden="true">✕</span>
              </button>
            </div>

            <div className={styles.viewerPaper}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={viewerRevision.title}
                className={styles.viewerImage}
                src={viewerRevision.imageUrl}
              />
            </div>

            <div className={styles.viewerActions}>
              <button
                className={styles.downloadButton}
                type="button"
                onClick={() => void handleDownload(viewerRevision)}
                disabled={viewerRevision.status !== "ready"}
              >
                Download PNG
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function isWorkingStatus(status: RevisionStatus) {
  return (
    status === "queued" ||
    status === "generating_source_image" ||
    status === "generating_line_art"
  );
}

function getStatusLabel(status: RevisionStatus) {
  switch (status) {
    case "queued":
      return "Queued";
    case "generating_source_image":
      return "Generating image";
    case "generating_line_art":
      return "Generating line art";
    case "failed":
      return "Failed";
    case "ready":
      return "Ready";
  }
}

function getPhaseLabel(phase?: AssistantStatusPhase) {
  switch (phase) {
    case "queued":
      return "Preparing your request...";
    case "generating_source_image":
      return "Generating image...";
    case "generating_line_art":
      return "Generating line art...";
    case "failed":
      return "Generation failed.";
    case "complete":
      return "Complete";
    default:
      return "Working...";
  }
}

function getRevisionMetaLabel(revision: Revision) {
  if (revision.status === "ready") {
    return formatTime(revision.createdAt);
  }

  return getStatusLabel(revision.status);
}

function getSubmitLabel(isBusy: boolean, hasUpload: boolean, status?: RevisionStatus) {
  if (isBusy) {
    if (status === "generating_source_image") {
      return "Generating image...";
    }

    if (status === "generating_line_art") {
      return "Generating line art...";
    }

    return "Working...";
  }

  if (hasUpload) {
    return "Convert image";
  }

  return "Create drawing";
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}
