import { createAuthClient } from 'better-auth/client';
import { db, type LocalDocument, type LocalSpace } from './idb';

// Initialize the Better Auth Client
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
          spaceId: d.spaceId,
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
          spaceId: sDoc.spaceId,
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

/**
 * Local-First Spaces Synchronization Engine
 * Pushes unsynced changes to the server and pulls newer changes from the server.
 */
export async function syncSpaces(): Promise<{ success: boolean; error?: string }> {
  try {
    const allLocalSpaces = await db.spaces.toArray();
    const unsyncedSpaces = allLocalSpaces.filter(s => !s.isSynced);

    const response = await apiFetch('/api/spaces/sync', {
      method: 'POST',
      body: JSON.stringify({
        spaces: allLocalSpaces.map(s => ({
          id: s.id,
          name: s.name,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        }))
      }),
    });

    if (response.status === 401) {
      return { success: false, error: 'Unauthorized' };
    }

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const { spaces: serverSpaces } = await response.json();
    const serverSpacesIds = new Set(serverSpaces.map((ss: any) => ss.id));

    await db.transaction('rw', db.spaces, async () => {
      // Mark local unsynced spaces as synced if the server accepted them
      for (const localSpace of unsyncedSpaces) {
        if (!serverSpacesIds.has(localSpace.id)) {
          await db.spaces.update(localSpace.id, { isSynced: true });
        }
      }

      // Merge server versions
      for (const sSpace of serverSpaces) {
        await db.spaces.put({
          id: sSpace.id,
          name: sSpace.name,
          createdAt: new Date(sSpace.createdAt).getTime(),
          updatedAt: new Date(sSpace.updatedAt).getTime(),
          isSynced: true,
        });
      }
    });

    return { success: true };
  } catch (err: any) {
    console.warn('Spaces sync failed:', err.message);
    return { success: false, error: err.message || 'Spaces sync failed' };
  }
}
