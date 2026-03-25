import { webhookService } from '../services/WebhookService';
import { logger } from '../config/logger';
import type { SmsGateWebhookPayload } from '../models/types';

export async function handleWebhooks(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // POST /webhooks/sms-gate - Receive SMS-Gate webhooks
  // Also accept POST / for ping webhooks that may be configured differently in the app
  if (req.method === 'POST' && (path === '/webhooks/sms-gate' || path === '/')) {
    try {
      const payload = await req.json() as SmsGateWebhookPayload;

      // Single line webhook log for debugging
      console.log(`[WEBHOOK] ${payload.event} | device:${payload.deviceId} | webhook:${payload.webhookId} | time:${new Date().toISOString()}`);

      logger.info({ 
        event: payload.event, 
        deviceId: payload.deviceId,
        webhookId: payload.webhookId
      }, 'Webhook received');

      // Process webhook asynchronously
      webhookService.processWebhook(payload).catch((error) => {
        logger.error({ error, payload }, 'Failed to process webhook');
      });

      // Return immediate success response
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to process webhook');
      return new Response(
        JSON.stringify({ error: 'Failed to process webhook' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Not found' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}
