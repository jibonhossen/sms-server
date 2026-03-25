import { env } from '../config/env';
import { logger } from '../config/logger';

export function validateApiKey(req: Request): boolean {
  const apiKey = req.headers.get('x-api-key');
  
  if (!apiKey) {
    return false;
  }

  return apiKey === env.API_KEY_SECRET;
}

export function createAuthMiddleware() {
  return async (req: Request): Promise<Response | null> => {
    // Skip auth for webhooks
    const url = new URL(req.url);
    if (url.pathname.startsWith('/webhooks')) {
      return null;
    }

    // Skip auth for health check and root path (for SMS-Gate ping)
    if (url.pathname === '/health' || url.pathname === '/') {
      return null;
    }

    if (!validateApiKey(req)) {
      logger.warn({ path: url.pathname }, 'Unauthorized request');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return null;
  };
}
