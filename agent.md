# Developer Handoff Document: d0c (DocZero)

This document provides a technical handoff for other agentic developers. It describes the state of the codebase, key architectural components, and next expansion vectors.

---

## 🏗️ Core Architecture & State

`d0c` is configured as a **TypeScript monorepo** managed with `pnpm` workspaces, isolating the frontend (`/apps/web`) from the backend (`/apps/server`).

### 1. Database & Schema (SQLite + Drizzle ORM)
*   **WAL Mode**: The connection in [apps/server/src/db/index.ts](file:///home/curtis/Desktop/dev/d0c/apps/server/db/index.ts) executes pragmas `journal_mode = WAL` and `synchronous = NORMAL` to optimize sqlite for high-frequency reads and concurrent safety.
*   **ID Strategy**: All tables use text strings (`UUID` / `ULID`) as primary keys to ensure offline-generated records do not cause id collisions when pushed to the server.
*   **Schema Map**: [apps/server/src/db/schema.ts](file:///home/curtis/Desktop/dev/d0c/apps/server/db/schema.ts) exposes:
    *   `user`, `session`, `account`, `verification` (Standard Better Auth credential tables)
    *   `document` (Note taking: `id`, `title`, `content` [JSON string], `isArchived`, timestamps)

### 2. Local-First Synchronization Engine
*   **IndexedDB Cache**: React client uses Dexie.js in [apps/web/src/services/idb.ts](file:///home/curtis/Desktop/dev/d0c/apps/web/src/services/idb.ts) to manage cache. It tracks local status using `isSynced` (boolean).
*   **Sync Logic**: The reconciliation algorithm in [apps/web/src/services/api.ts](file:///home/curtis/Desktop/dev/d0c/apps/web/src/services/api.ts) and [apps/server/src/routes/documents.ts](file:///home/curtis/Desktop/dev/d0c/apps/server/routes/documents.ts) executes a **Last-Write-Wins (LWW) sync**:
    1.  Client uploads its entire local documents manifest.
    2.  For new client documents, the server creates corresponding records.
    3.  For shared documents, the server compares `updatedAt` timestamps. If the client version is newer, the server updates. If the server version is newer, the server flags it to send back.
    4.  Server returns all newer records to the client to update the IndexedDB cache locally.
    5.  Client marks successfully pushed documents as `isSynced = true`.
*   **Auto-save & Sync Intervals**: React auto-saves updates to IndexedDB instantly. A background loop inside `App.tsx` triggers server synchronization every 10 seconds (or manually via header toolbar).

### 3. Rich Editor & Slash Commands
*   **Editor Component**: [apps/web/src/components/Editor.tsx](file:///home/curtis/Desktop/dev/d0c/apps/web/src/components/Editor.tsx) wraps Tiptap Core. It parses and stringifies JSON document structures directly from IndexedDB.
*   **Slash Command Extension**: Implements a custom keyboard-navigable (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`) popup menu when `/` is typed in the editor. 
*   **Media Uploads**: Interfacing "Upload Image" command triggers file inputs, uploading files to Hono `/api/storage/upload` and rendering them natively using `@tiptap/extension-image`.

### 4. Media Storage Service
*   **Disk Module**: [apps/server/src/services/storage.ts](file:///home/curtis/Desktop/dev/d0c/apps/server/services/storage.ts) writes uploaded attachments to `/data/storage`. Path traversal prevention checks are enforced.
*   **Serving Assets**: Hono streams media back using path checks and sets explicit cache headers to optimize local network usage.

---

## 🛠️ Dev Ops & CI/CD Status

1.  **Vite Proxy**: [apps/web/vite.config.ts](file:///home/curtis/Desktop/dev/d0c/apps/web/vite.config.ts) proxies `/api/*` to Hono.
2.  **Dockerfile**: [apps/server/Dockerfile](file:///home/curtis/Desktop/dev/d0c/apps/server/Dockerfile) implements a production multi-stage build. In production, Hono serves `/apps/web/dist` directly as static assets, packing client and server into one deployable image.
3.  **GitHub Actions**: A CI/CD workflow at [.github/workflows/docker-publish.yml](file:///home/curtis/Desktop/dev/d0c/.github/workflows/docker-publish.yml) publishes the docker container directly to `ghcr.io` on pushes to `main`.
4.  **Local migrations**: Managed via `pnpm --filter server db:generate` and `pnpm --filter server db:migrate`.

---

## ⏩ Next Steps / Task Backlog

*   [ ] **Capacitor Mobile Package**: Scaffold `/apps/mobile` containing Capacitor configuration. Link web assets in `/apps/web/dist` to target build folder in iOS/Android directories.
*   [ ] **Authentication Verification Page**: Configure mailer in Better Auth to dispatch verification emails (currently auto-logs in for ease of local usage).
*   [ ] **Conflict History**: Record sync revisions to allow rollbacks or visual comparison of conflict states.
