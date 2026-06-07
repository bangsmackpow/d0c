# Developer Handoff Document: d0c (DocZero)

This document provides a technical handoff for other agentic developers. It describes the state of the codebase, key architectural components, and next expansion vectors.

---

## 🏗️ Core Architecture & State

`d0c` is configured as a **TypeScript monorepo** managed with `pnpm` workspaces, isolating the frontend (`/apps/web`) from the backend (`/apps/server`).

### 1. Database & Schema (SQLite + Drizzle ORM)
*   **WAL Mode**: The connection in [apps/server/src/db/index.ts](file:///home/curtis/Desktop/dev/d0c/apps/server/src/db/index.ts) executes pragmas `journal_mode = WAL` and `synchronous = NORMAL`.
*   **ID Strategy**: All tables use text strings (`UUID` / `ULID`) as primary keys.
*   **Schema Map**: [apps/server/src/db/schema.ts](file:///home/curtis/Desktop/dev/d0c/apps/server/src/db/schema.ts) exposes:
    *   `user`, `session`, `account`, `verification` (Standard Better Auth credential tables)
    *   `spaces` (Spaces/Folders: `id`, `name`, `userId`, timestamps)
    *   `document` (Note taking: `id`, `title`, `content` [JSON], `userId`, `spaceId` [references spaces.id], `isArchived`, timestamps)

### 2. Spaces / Folders Organization
*   **Completed**: Documents are grouped into collapsible Spaces (Folders) inside the sidebar.
*   **Actions**: Users can create spaces, rename them inline, delete them (which soft-detaches documents inside by setting their `spaceId` to `null`), and add notes directly inside specific spaces.

### 3. Local-First Synchronization Engine
*   **IndexedDB Cache**: React client uses Dexie.js in [apps/web/src/services/idb.ts](file:///home/curtis/Desktop/dev/d0c/apps/web/src/services/idb.ts). Bumped to database version 2, registering `spaces` and indexing `spaceId` in `documents`.
*   **Sync Logic**: Reconciles client modifications using LWW sync:
    *   `syncSpaces` and `syncDocuments` are run sequentially in the synchronization interval inside `App.tsx` (every 10 seconds).
    *   Spaces are synced first so that new spaces are created on the server before documents referring to them are synced.

### 4. Rich Editor & Slash Commands
*   **Editor Component**: [apps/web/src/components/Editor.tsx](file:///home/curtis/Desktop/dev/d0c/apps/web/src/components/Editor.tsx) wraps Tiptap Core and exposes custom `/` slash commands (headings, lists, code, uploads).

---

## 🛠️ Dev Ops, Deployment & CI/CD

1.  **Vite Proxy**: [apps/web/vite.config.ts](file:///home/curtis/Desktop/dev/d0c/apps/web/vite.config.ts) proxies `/api/*` to Hono.
2.  **Dockerfile**: [apps/server/Dockerfile](file:///home/curtis/Desktop/dev/d0c/apps/server/Dockerfile) implements production multi-stage containerization.
3.  **Docker Compose**: [docker-compose.yml](file:///home/curtis/Desktop/dev/d0c/docker-compose.yml) is created at the root, mapping ports and volumes via environment variables.
4.  **Environments**: Templates [.env](file:///home/curtis/Desktop/dev/d0c/.env) and [stack.env](file:///home/curtis/Desktop/dev/d0c/stack.env) are configured for Portainer stack installations.
5.  **GitHub Actions**: A CI/CD workflow at [.github/workflows/docker-publish.yml](file:///home/curtis/Desktop/dev/d0c/.github/workflows/docker-publish.yml) publishes the docker container directly to `ghcr.io` on pushes to `main`.

---

## ⏩ Next Steps / Task Backlog

*   [ ] **Tiptap Slash Command Expansion**: Add task checklists (`[ ]`), tables, and callouts to slash commands dropdown.
*   [ ] **Full-Text & Tag Search**: Implement search through all local notes cached in IndexedDB.
*   [ ] **Capacitor Mobile Package**: Scaffold `/apps/mobile` containing Capacitor configurations.
