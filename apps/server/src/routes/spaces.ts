import { Hono } from 'hono';
import { db } from '../db/index.js';
import { spaces } from '../db/schema.js';
import { auth } from '../auth.js';
import { eq, and } from 'drizzle-orm';

const spacesRouter = new Hono();

// Helper to authenticate requests using Better Auth session
async function getAuthUser(c: any) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  return session;
}

// 1. GET ALL
spacesRouter.get('/', async (c) => {
  const session = await getAuthUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const userSpaces = await db
    .select()
    .from(spaces)
    .where(eq(spaces.userId, session.user.id));

  return c.json(userSpaces);
});

// 2. CREATE
spacesRouter.post('/', async (c) => {
  const session = await getAuthUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const spaceId = body.id || crypto.randomUUID();

  const newSpace = {
    id: spaceId,
    name: body.name || 'New Space',
    userId: session.user.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(spaces).values(newSpace);
  return c.json(newSpace, 201);
});

// 3. UPDATE
spacesRouter.put('/:id', async (c) => {
  const session = await getAuthUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const spaceId = c.req.param('id');
  const body = await c.req.json();

  const [existing] = await db
    .select()
    .from(spaces)
    .where(and(eq(spaces.id, spaceId), eq(spaces.userId, session.user.id)));

  if (!existing) return c.json({ error: 'Space not found' }, 404);

  const updated = {
    name: body.name !== undefined ? body.name : existing.name,
    updatedAt: new Date(),
  };

  await db.update(spaces).set(updated).where(eq(spaces.id, spaceId));
  return c.json({ ...existing, ...updated });
});

// 4. DELETE
spacesRouter.delete('/:id', async (c) => {
  const session = await getAuthUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const spaceId = c.req.param('id');

  const [existing] = await db
    .select()
    .from(spaces)
    .where(and(eq(spaces.id, spaceId), eq(spaces.userId, session.user.id)));

  if (!existing) return c.json({ error: 'Space not found' }, 404);

  await db.delete(spaces).where(eq(spaces.id, spaceId));
  return c.json({ success: true });
});

// 5. SYNC (Last-Write-Wins Bidirectional Sync for Spaces)
spacesRouter.post('/sync', async (c) => {
  const session = await getAuthUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const clientSpaces = body.spaces || [];

  const serverSpaces = await db
    .select()
    .from(spaces)
    .where(eq(spaces.userId, session.user.id));

  const serverSpacesMap = new Map(serverSpaces.map((s) => [s.id, s]));
  const clientSpacesMap = new Map(clientSpaces.map((s: any) => [s.id, s]));

  const responseSpaces: any[] = [];

  // A. Process client spaces: insert or update server if client has newer version
  for (const clientSpace of clientSpaces) {
    const serverSpace = serverSpacesMap.get(clientSpace.id);
    const clientUpdatedAt = new Date(clientSpace.updatedAt).getTime();

    if (!serverSpace) {
      const newSpace = {
        id: clientSpace.id,
        name: clientSpace.name || 'New Space',
        userId: session.user.id,
        createdAt: new Date(clientSpace.createdAt || clientSpace.updatedAt),
        updatedAt: new Date(clientSpace.updatedAt),
      };
      await db.insert(spaces).values(newSpace);
    } else {
      const serverUpdatedAt = new Date(serverSpace.updatedAt).getTime();
      if (clientUpdatedAt > serverUpdatedAt) {
        const updateData = {
          name: clientSpace.name || serverSpace.name,
          updatedAt: new Date(clientSpace.updatedAt),
        };
        await db.update(spaces).set(updateData).where(eq(spaces.id, clientSpace.id));
      } else if (serverUpdatedAt > clientUpdatedAt) {
        responseSpaces.push(serverSpace);
      }
    }
  }

  // B. Process spaces that are on the server but weren't sent by client
  for (const serverSpace of serverSpaces) {
    if (!clientSpacesMap.has(serverSpace.id)) {
      responseSpaces.push(serverSpace);
    }
  }

  return c.json({ spaces: responseSpaces });
});

export default spacesRouter;
