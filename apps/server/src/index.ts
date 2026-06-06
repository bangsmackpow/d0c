import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import authRouter from './routes/auth.js';
import documentsRouter from './routes/documents.js';
import storageRouter from './routes/storage.js';
import { sqlite } from './db/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { serveStatic } from '@hono/node-server/serve-static';

dotenv.config();

const app = new Hono();

// Logging middleware
app.use('*', logger());

// Enable CORS for development
app.use('*', cors({
  origin: (origin) => origin || '*', // Dynamic origin reflections to support credentials
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-session-token'],
  exposeHeaders: ['set-cookie'],
}));

// API Routes
app.route('/api/auth', authRouter);
app.route('/api/documents', documentsRouter);
app.route('/api/storage', storageRouter);

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', time: new Date() });
});

// Serve frontend assets in production mode
if (process.env.NODE_ENV === 'production') {
  // Direct requests to frontend index.html if no api match is found
  app.use('/*', serveStatic({
    root: './apps/web/dist',
    rewriteRequestPath: (path) => {
      // If the route doesn't have an extension (e.g. index.js, main.css), fallback to index.html
      const hasExtension = path.split('/').pop()?.includes('.');
      if (!hasExtension) {
        return '/index.html';
      }
      return path;
    }
  }));
}

const port = Number(process.env.PORT) || 3000;
console.log(`Starting d0c Hono server on port ${port}...`);

const server = serve({
  fetch: app.fetch,
  port,
});

// Clean shutdowns
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  sqlite.close();
  server.close();
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  sqlite.close();
  server.close();
});
