# Line Art Creator — Project Context

> Last updated: 2026-03-22

---

## 1. What Is This?

**Line Art Creator** is a private, AI-powered web application that lets any user — regardless of drawing skill — produce clean, printable cartoon-style line art simply by describing what they want in plain language.

The user types a description, the app generates line art, and the user can keep refining the result through natural follow-up instructions until they are satisfied. The final image is exported as a print-ready A4 PNG.

---

## 2. Core Value Proposition

| Problem | This product's answer |
|---|---|
| Most people can't draw | Natural-language prompts replace the need for any artistic skill |
| Generic AI tools don't reliably produce clean line art | A dedicated two-stage pipeline (source image → line art conversion) produces consistent, print-ready output |
| Iterative AI prompting often loses context | A persistent revision history with restore/branch support keeps all history intact |
| Exporting to A4 is inconsistent elsewhere | A4 portrait is a built-in layout constraint, not an afterthought |

**Primary use cases:**
- Parents generating coloring pages for children
- Designers creating line-art drafts or printable cartoon assets
- Children creating their own coloring pages

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| AI Provider | Google Gemini (via `@google/generative-ai`) |
| Storage | Netlify Blobs (images) + `data/project.json` (metadata) |
| Hosting | Netlify (with `@netlify/plugin-nextjs`) |
| Image processing | `sharp` |

The application is deployed at **J7sup.com** under the `/lineartcreator` path.

---

## 4. Architecture Overview

### 4.1 Generation Pipeline (Two-Stage)

The core generation flow is a **two-stage async pipeline**:

```
User prompt
     │
     ▼
[Stage 1] Gemini → generate source image  (status: generating_source_image)
     │
     ▼
[Stage 2] Gemini → convert to line art    (status: generating_line_art)
     │
     ▼
Save final image                          (status: ready)
```

Alternatively, a user can **upload an image** to skip Stage 1 and go directly to the line art conversion stage.

### 4.2 Key Server Modules (`lib/server/`)

| File | Responsibility |
|---|---|
| `line-art-provider.ts` | Gemini API calls — source image generation and line art conversion |
| `project-store.ts` | Full project CRUD: creating/updating/restoring revisions, writing messages |
| `asset-store.ts` | Saving and serving image assets (uploads, source images, final line art) |
| `revision-job.ts` | Async job runner that advances the revision state machine |
| `rate-limit.ts` | Simple request rate limiting |

### 4.3 API Routes (`app/api/`)

| Route | Purpose |
|---|---|
| `POST /api/project/revisions` | Create a new revision (text prompt or image upload) |
| `GET /api/project/revisions` | List/poll revisions and their current status |
| `POST /api/project/revisions/restore` | Restore an earlier revision as the active version |
| `POST /api/project/revisions/reset` | Reset project state |
| `GET /api/assets/[...assetPath]` | Serve stored image assets |

### 4.4 Data Model

The central domain types are defined in `lib/domain.ts`.

**Revision** — a single generation attempt:
```ts
type Revision = {
  id: string;
  parentRevisionId: string | null;    // for branching/restore
  title: string;
  prompt: string;
  editInstruction: string | null;
  status: RevisionStatus;             // see state machine below
  createdAt: string;
  sourceType: "prompt" | "upload" | "revision";
  sourceImageUrl: string | null;      // Stage 1 image
  imageUrl: string;                   // Final line art
  thumbnailUrl: string;
  modelName: string;
  jobId: string | null;
  errorMessage: string | null;
};
```

**Revision state machine:**
```
queued → generating_source_image → generating_line_art → ready
                                                       ↘ failed
```

**Project** — top-level container:
```ts
type Project = {
  id: string;
  name: string;
  activeRevisionId: string | null;
  revisions: Revision[];
  messages: Message[];   // full conversation history
};
```

### 4.5 Frontend

A single-page workspace component (`components/line-art-workspace.tsx`) handles:
- Chat-style prompt input
- Real-time generation status display (per-phase labels)
- Revision history sidebar with restore/branch
- Image preview and download
- File upload input for the image-to-line-art flow
- Polling loop (every ~1–2 s) to reflect async job progress

---

## 5. Security Model

- The Gemini API key is **server-side only** (stored in `.env.local`, never exposed to the browser).
- All generation requests go through Next.js API routes on the backend.
- Basic rate limiting is applied to generation endpoints.

---

## 6. Current Status (as of 2026-03-22)

- ✅ PRD defined (`PRD.md`)
- ✅ Domain types and revision state machine implemented (`lib/domain.ts`)
- ✅ Two-stage pipeline design documented (`REFACTOR_PLAN.md`)
- ✅ Backend server modules scaffolded (`lib/server/`)
- ✅ Frontend workspace component exists (`components/line-art-workspace.tsx`)
- ✅ Deployed to Netlify at `j7sup.com/lineartcreator`
- 🔄 Gemini API integration actively being refined (model selection, SDK version)
- 🔄 Async revision job pipeline in progress (per `REFACTOR_PLAN.md`)

---

## 7. Key Design Decisions

1. **Private tool first** — No multi-user auth in MVP; single owner's API key powers all generation.
2. **One result per request** — Avoids choice paralysis; keeps the UX simple.
3. **Revision history over overwriting** — Users should always feel safe iterating; any version is recoverable.
4. **A4 portrait as a built-in constraint** — Not a setting the user manages; just works out of the box.
5. **Polling over SSE** — Simpler to implement, debug, and maintain at this project scale.
6. **Provider-agnostic architecture** — Model name comes from environment variables; swapping providers should not require business logic changes.

---

## 8. Future Roadmap (Post-MVP)

- Reference image upload (already partially scaffolded)
- Character consistency tools across revisions
- Style preset library (line weight, fill style, etc.)
- PDF export
- Multi-variant generation
- User accounts and saved project libraries
- Shareable project links
- Usage dashboard and quotas

---

## 9. Key Files at a Glance

| File | Purpose |
|---|---|
| `PRD.md` | Full product requirements document |
| `REFACTOR_PLAN.md` | Two-stage pipeline architecture and refactor plan (bilingual) |
| `lib/domain.ts` | All shared TypeScript domain types |
| `lib/line-art.ts` | Client-side API helpers |
| `lib/server/line-art-provider.ts` | Gemini integration logic |
| `lib/server/project-store.ts` | Project and revision persistence |
| `lib/server/asset-store.ts` | Image file storage |
| `lib/server/revision-job.ts` | Async job runner |
| `components/line-art-workspace.tsx` | Main UI component |
| `netlify.toml` | Deployment config (includes proxy redirects for other projects) |
| `.env.local` | Local secrets (Gemini API key, etc.) — not committed |
