import { env } from './config/env';
import { logger } from './config/logger';
import { handleMessages } from './routes/messages';
import { handleDevices } from './routes/devices';
import { handleSims } from './routes/sims';
import { handleWebhooks } from './routes/webhooks';
import { handleWebhookManager } from './routes/webhookManager';
import { createAuthMiddleware } from './middleware/auth';
import { healthCheckScheduler } from './scheduler/HealthCheckScheduler';

const authMiddleware = createAuthMiddleware();

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  logger.debug({ method: req.method, path }, 'Incoming request');

  // Health check endpoint
  if (path === '/health') {
    return new Response(
      JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Root path - for SMS-Gate ping and health checks
  if (path === '/') {
    // Log ping requests for debugging
    console.log('\n========================================');
    console.log('🏓 PING RECEIVED');
    console.log('========================================');
    console.log('Method:', req.method);
    console.log('Path:', path);
    console.log('Timestamp:', new Date().toISOString());
    console.log('========================================\n');

    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        service: 'SMS Gateway Server',
        timestamp: new Date().toISOString() 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check authentication
  const authResponse = await authMiddleware(req);
  if (authResponse) {
    return authResponse;
  }

  // Route handling
  // Webhook manager routes (must be before devices route to handle /api/v1/devices/:id/webhooks)
  if (path.startsWith('/api/v1/webhooks') || (path.includes('/webhooks') && path.startsWith('/api/v1/devices'))) {
    return handleWebhookManager(req);
  }

  if (path.startsWith('/api/v1/messages')) {
    return handleMessages(req);
  }

  if (path.startsWith('/api/v1/devices')) {
    return handleDevices(req);
  }

  if (path.startsWith('/api/v1/sims')) {
    return handleSims(req);
  }

  if (path.startsWith('/webhooks')) {
    return handleWebhooks(req);
  }

  // 404 for unknown routes
  return new Response(
    JSON.stringify({ error: 'Not found' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}

// CORS headers
function addCorsHeaders(response: Response): Response {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  return response;
}

// Main request handler with CORS
async function mainHandler(req: Request): Promise<Response> {
  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
      },
    });
  }

  const response = await handleRequest(req);
  return addCorsHeaders(response);
}

// Start server
const server = Bun.serve({
  port: env.PORT,
  fetch: mainHandler,
});

logger.info(`Server started on port ${env.PORT}`);

// Start scheduler
healthCheckScheduler.start();

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down server...');
  healthCheckScheduler.stop();
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down server...');
  healthCheckScheduler.stop();
  server.stop();
  process.exit(0);
});
