import { createAuthClient } from 'better-auth/client';
import { db, type LocalDocument } from './idb';

// Initialize the Better Auth Client
// baseURL is window.location.origin because we proxy /api/auth via Vite dev proxy
// and serve from the same port in production.
export const authClient = createAuthClient({
  baseURL: window.location.origin,
});

/**
 * Standard fetch wrapper that handles credentials and default headers
 */
export async function apiFetch(url: string, options: RequestInit = {}) {
  options.headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  const response = await fetch(url, options);
  return response;
}

/**
 * Local-First Document Synchronization Engine
 * Pushes unsynced changes to the server and pulls newer changes from the server.
 */
export async function syncDocuments(): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Get all local documents (both synced and unsynced)
    const allLocalDocs = await db.documents.toArray();
    const unsyncedDocs = allLocalDocs.filter(d => !d.isSynced);

    // 2. Post all local states to `/api/documents/sync`
    const response = await apiFetch('/api/documents/sync', {
      method: 'POST',
      body: JSON.stringify({
        documents: allLocalDocs.map(d => ({
          id: d.id,
          title: d.title,
          content: d.content,
          isArchived: d.isArchived,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        }))
      }),
    });

    if (response.status === 401) {
      return { success: false, error: 'Unauthorized' };
    }

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const { documents: serverDocs } = await response.json();
    const serverDocsIds = new Set(serverDocs.map((sd: any) => sd.id));

    // 3. Complete database transaction to store updates safely
    await db.transaction('rw', db.documents, async () => {
      // A. For any document we sent that was NOT returned as "newer on server", 
      // we can mark it as synced.
      for (const localDoc of unsyncedDocs) {
        if (!serverDocsIds.has(localDoc.id)) {
          await db.documents.update(localDoc.id, { isSynced: true });
        }
      }

      // B. Save/overwrite local DB with documents sent back by the server
      for (const sDoc of serverDocs) {
        await db.documents.put({
          id: sDoc.id,
          title: sDoc.title,
          content: sDoc.content,
          isArchived: sDoc.isArchived,
          createdAt: new Date(sDoc.createdAt).getTime(),
          updatedAt: new Date(sDoc.updatedAt).getTime(),
          isSynced: true,
        });
      }
    });

    return { success: true };
  } catch (err: any) {
    console.warn('Sync failed (offline or network error):', err.message);
    return { success: false, error: err.message || 'Sync failed' };
  }
}
