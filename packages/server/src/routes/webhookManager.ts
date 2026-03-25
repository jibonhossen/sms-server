import { webhookManagerService } from '../services/WebhookManagerService';
import { deviceService } from '../services/DeviceService';
import { logger } from '../config/logger';
import type { RegisterWebhookRequest } from '../services/WebhookManagerService';

export async function handleWebhookManager(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // GET /api/v1/webhooks/events - Get supported webhook events (must be before device webhooks)
  if (req.method === 'GET' && path === '/api/v1/webhooks/events') {
    try {
      const events = webhookManagerService.getSupportedEvents();

      return new Response(
        JSON.stringify({
          success: true,
          data: events,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to get webhook events');
      return new Response(
        JSON.stringify({ error: 'Failed to get webhook events' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // GET /api/v1/devices/:id/webhooks - List webhooks for a device
  if (req.method === 'GET' && path.includes('/devices/') && path.includes('/webhooks')) {
    const parts = path.split('/');
    const deviceId = parts[4];

    try {
      if (!deviceId) {
        return new Response(
          JSON.stringify({ error: 'Device ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const device = await deviceService.getDeviceById(deviceId);
      if (!device) {
        return new Response(
          JSON.stringify({ error: 'Device not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const webhooks = await webhookManagerService.getWebhooksByDevice(deviceId);

      return new Response(
        JSON.stringify({
          success: true,
          data: webhooks,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to list webhooks');
      return new Response(
        JSON.stringify({ error: 'Failed to list webhooks' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // POST /api/v1/devices/:id/webhooks - Register new webhook
  if (req.method === 'POST' && path.includes('/devices/') && path.includes('/webhooks')) {
    const parts = path.split('/');
    const deviceId = parts[4];

    try {
      if (!deviceId) {
        return new Response(
          JSON.stringify({ error: 'Device ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const device = await deviceService.getDeviceById(deviceId);
      if (!device) {
        return new Response(
          JSON.stringify({ error: 'Device not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const body = await req.json() as RegisterWebhookRequest;

      // Validate request
      if (!body.url || typeof body.url !== 'string') {
        return new Response(
          JSON.stringify({ error: 'url is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!body.event || typeof body.event !== 'string') {
        return new Response(
          JSON.stringify({ error: 'event is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const webhook = await webhookManagerService.registerWebhook(device, body);

      return new Response(
        JSON.stringify({
          success: true,
          data: webhook,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to register webhook');
      const errorMessage = error instanceof Error ? error.message : 'Failed to register webhook';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // DELETE /api/v1/webhooks/:id - Delete webhook
  if (req.method === 'DELETE' && path.startsWith('/api/v1/webhooks/')) {
    const webhookId = path.split('/').pop();

    try {
      if (!webhookId) {
        return new Response(
          JSON.stringify({ error: 'Webhook ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Find webhook to get device
      const webhook = await webhookManagerService.getWebhookById(webhookId);
      if (!webhook) {
        return new Response(
          JSON.stringify({ error: 'Webhook not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const device = await deviceService.getDeviceById(webhook.deviceId);
      if (!device) {
        return new Response(
          JSON.stringify({ error: 'Device not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      await webhookManagerService.deleteWebhook(device, webhook.webhookId);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook deleted successfully',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to delete webhook');
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete webhook';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // PATCH /api/v1/webhooks/:id/status - Toggle webhook status
  if (req.method === 'PATCH' && path.includes('/webhooks/') && path.endsWith('/status')) {
    const parts = path.split('/');
    const webhookId = parts[4];

    try {
      if (!webhookId) {
        return new Response(
          JSON.stringify({ error: 'Webhook ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const body = await req.json() as { isActive: boolean };

      if (typeof body.isActive !== 'boolean') {
        return new Response(
          JSON.stringify({ error: 'isActive must be a boolean' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      await webhookManagerService.toggleWebhookStatus(webhookId, body.isActive);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook status updated',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to update webhook status');
      return new Response(
        JSON.stringify({ error: 'Failed to update webhook status' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Not found' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}
