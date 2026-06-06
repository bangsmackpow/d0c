import { Hono } from 'hono';
import { saveFile, getFilePath } from '../services/storage.js';
import { auth } from '../auth.js';
import fs from 'fs';
import path from 'path';

const storageRouter = new Hono();

// Helper to authenticate session
async function getAuthUser(c: any) {
  return await auth.api.getSession({
    headers: c.req.raw.headers,
  });
}

// 1. Upload File
storageRouter.post('/upload', async (c) => {
  const session = await getAuthUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await c.req.parseBody();
    const file = body.file;

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file uploaded or invalid format' }, 400);
    }

    const filename = await saveFile(file);
    const fileUrl = `/api/storage/files/${filename}`;

    return c.json({
      success: true,
      filename,
      url: fileUrl,
    });
  } catch (error: any) {
    console.error('File upload error:', error);
    return c.json({ error: 'File upload failed' }, 500);
  }
});

// 2. Serve File
storageRouter.get('/files/:filename', async (c) => {
  const filename = c.req.param('filename');
  const filePath = getFilePath(filename);

  if (!filePath) {
    return c.text('File not found or access denied', 404);
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';

    switch (ext) {
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
      case '.pdf':
        contentType = 'application/pdf';
        break;
    }

    const fileBuffer = await fs.promises.readFile(filePath);
    
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // Cache locally for 1 year
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return c.text('Internal Server Error', 500);
  }
});

export default storageRouter;
