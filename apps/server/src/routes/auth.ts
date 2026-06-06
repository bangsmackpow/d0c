import { Hono } from 'hono';
import { auth } from '../auth.js';

const authRouter = new Hono();

// Mount all Better Auth endpoints (* matches login, signup, sessions, etc.)
authRouter.on(['POST', 'GET'], '/*', (c) => {
  return auth.handler(c.req.raw);
});

export default authRouter;
