import { Hono } from 'hono';
import { db } from '../db/index.js';
import { documents } from '../db/schema.js';
import { auth } from '../auth.js';
import { eq, and, inArray } from 'drizzle-orm';

const documentsRouter = new Hono();

// Helper to authenticate requests using Better Auth session
async function getAuthUser(c: any) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  return session;
}

// 1. GET ALL
documentsRouter.get('/', async (c) => {
  const session = await getAuthUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, session.user.id), eq(documents.isArchived, false)));

  return c.json(docs);
});

// 2. GET ONE
documentsRouter.get('/:id', async (c) => {
  const session = await getAuthUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const docId = c.req.param('id');
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.userId, session.user.id)));

  if (!doc) return c.json({ error: 'Document not found' }, 404);
  return c.json(doc);
});

// 3. CREATE
documentsRouter.post('/', async (c) => {
  const session = await getAuthUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const docId = body.id || crypto.randomUUID(); // Accept client-generated ID

  const newDoc = {
    id: docId,
    title: body.title || 'Untitled',
    content: body.content || '{}',
    userId: session.user.id,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(documents).values(newDoc);
  return c.json(newDoc, 201);
});

// 4. UPDATE
documentsRouter.put('/:id', async (c) => {
  const session = await getAuthUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const docId = c.req.param('id');
  const body = await c.req.json();

  const [existing] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.userId, session.user.id)));

  if (!existing) return c.json({ error: 'Document not found' }, 404);

  const updated = {
    title: body.title !== undefined ? body.title : existing.title,
    content: body.content !== undefined ? body.content : existing.content,
    isArchived: body.isArchived !== undefined ? body.isArchived : existing.isArchived,
    updatedAt: new Date(),
  };

  await db.update(documents).set(updated).where(eq(documents.id, docId));
  return c.json({ ...existing, ...updated });
});

// 5. DELETE (Archive or Hard Delete - here we do soft-delete/archive)
documentsRouter.delete('/:id', async (c) => {
  const session = await getAuthUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const docId = c.req.param('id');

  const [existing] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.userId, session.user.id)));

  if (!existing) return c.json({ error: 'Document not found' }, 404);

  await db
    .update(documents)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(documents.id, docId));

  return c.json({ success: true });
});

// 6. SYNC (Last-Write-Wins Bidirectional Sync)
documentsRouter.post('/sync', async (c) => {
  const session = await getAuthUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  // clientDocs is an array of: { id, title, content, isArchived, updatedAt, createdAt }
  const clientDocs = body.documents || [];

  // Fetch all documents currently on the server for this user
  const serverDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, session.user.id));

  const serverDocsMap = new Map(serverDocs.map((doc) => [doc.id, doc]));
  const clientDocsMap = new Map(clientDocs.map((doc: any) => [doc.id, doc]));

  const responseDocs: any[] = [];

  // 1. Process client documents: insert or update server if client has newer version
  for (const clientDoc of clientDocs) {
    const serverDoc = serverDocsMap.get(clientDoc.id);
    const clientUpdatedAt = new Date(clientDoc.updatedAt).getTime();

    if (!serverDoc) {
      // Document is new to server
      const newDoc = {
        id: clientDoc.id,
        title: clientDoc.title || 'Untitled',
        content: clientDoc.content || '{}',
        userId: session.user.id,
        isArchived: clientDoc.isArchived === true,
        createdAt: new Date(clientDoc.createdAt || clientDoc.updatedAt),
        updatedAt: new Date(clientDoc.updatedAt),
      };
      await db.insert(documents).values(newDoc);
    } else {
      const serverUpdatedAt = new Date(serverDoc.updatedAt).getTime();
      if (clientUpdatedAt > serverUpdatedAt) {
        // Client version is newer, update server
        const updateData = {
          title: clientDoc.title || serverDoc.title,
          content: clientDoc.content || serverDoc.content,
          isArchived: clientDoc.isArchived === true,
          updatedAt: new Date(clientDoc.updatedAt),
        };
        await db.update(documents).set(updateData).where(eq(documents.id, clientDoc.id));
      } else if (serverUpdatedAt > clientUpdatedAt) {
        // Server version is newer, queue server version to return to client
        responseDocs.push(serverDoc);
      }
    }
  }

  // 2. Process documents that are on the server but weren't sent by client
  // (e.g. created on another device)
  for (const serverDoc of serverDocs) {
    if (!clientDocsMap.has(serverDoc.id)) {
      responseDocs.push(serverDoc);
    }
  }

  // Return the documents the client needs to update locally
  return c.json({ documents: responseDocs });
});

export default documentsRouter;
