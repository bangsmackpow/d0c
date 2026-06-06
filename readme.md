# d0c — DocZero ⚡

A lightweight, high-performance, local-first documentation and personal note-taking web application designed for self-hosting (<10 users).

## 🚀 Features

*   **Offline-First & Local Persistence**: Writes and caches note edits instantly to client-side **IndexedDB** (via Dexie.js).
*   **Bidirectional Last-Write-Wins Sync**: Seamless sync engine that compares timestamps with the server database when connection is restored.
*   **Rich Text Editor (Tiptap)**: Structured JSON representation format. Features keyboard-navigable **slash (`/`) commands** for formatting and file uploads.
*   **High Performance SQLite Backend**: Powered by Node.js, **Hono**, and **Drizzle ORM** on top of `better-sqlite3`. Configured with native **Write-Ahead Logging (WAL)** and synchronous mode set to `NORMAL` for concurrent safety.
*   **Local Filesystem Storage**: Embedded media and files are stored securely on the server's disk space inside `/data/storage`.
*   **Better Auth Integration**: Secured credentials-based session authentication using standard local SQLite tables.
*   **Single-Container Package**: Production Docker builds serve the compiled SPA static web assets directly from Hono, packaging the entire project into a single Docker container.

---

## 🛠️ Project Structure

```text
d0c/
├── apps/
│   ├── server/             # Hono API backend & server
│   │   ├── src/
│   │   │   ├── db/         # SQLite WAL connection & schemas
│   │   │   ├── routes/     # Auth, document, and storage endpoints
│   │   │   ├── services/   # Disk storage module
│   │   │   └── index.ts    # Server entrypoint
│   │   └── Dockerfile      # Production Docker configuration
│   │
│   └── web/                # React / Vite SPA frontend
│       ├── src/
│       │   ├── components/ # Editor & Sidebar layouts
│       │   ├── services/   # IndexedDB & Server sync services
│       │   ├── index.css   # Premium dark aesthetic CSS system
│       │   └── main.tsx    # React mountpoint
│
├── pnpm-workspace.yaml     # Monorepo workspaces
└── package.json            # Workspace orchestration
```

---

## 💻 Local Development

### 1. Requirements
*   Node.js (v20+)
*   pnpm (v9+)

### 2. Installation
Install all workspace dependencies:
```bash
pnpm install
```

### 3. Database Migration
Initialize the local SQLite database and schemas:
```bash
pnpm --filter server db:generate
pnpm --filter server db:migrate
```

### 4. Start Development Server
Start the frontend and backend in parallel:
```bash
pnpm dev
```
*   Frontend will launch at: `http://localhost:5173`
*   Hono API server will launch at: `http://localhost:3000`

---

## 📦 Production Deployment

### Docker (Recommended)
`d0c` compiles both client and server into a single container:

```bash
# Build the Docker image
docker build -t d0c-app -f apps/server/Dockerfile .

# Run the container (binds SQLite DB and uploads to local host folder)
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/data \
  -e BETTER_AUTH_SECRET="your-secure-secret-here" \
  d0c-app
```

### CI/CD
A GitHub Action is configured at `.github/workflows/docker-publish.yml` to automatically build and push the docker container to **GitHub Container Registry (GHCR)** on every push to `main`.
