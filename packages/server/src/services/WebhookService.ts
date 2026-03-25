import { db } from '../db';
import { webhookLogs, type NewWebhookLog } from '../db/schema';
import { logger } from '../config/logger';
import { messageService } from './MessageService';
import { deviceService } from './DeviceService';
import type { SmsGateWebhookPayload, WebhookEventType } from '../models/types';

export class WebhookService {
  async processWebhook(payload: SmsGateWebhookPayload): Promise<void> {
    logger.info({ 
      event: payload.event, 
      deviceId: payload.deviceId 
    }, 'Processing webhook');

    // Log the webhook
    await this.logWebhook(payload);

    switch (payload.event) {
      case 'sms:sent':
        await this.handleSmsSent(payload);
        break;
      case 'sms:delivered':
        await this.handleSmsDelivered(payload);
        break;
      case 'sms:failed':
        await this.handleSmsFailed(payload);
        break;
      case 'system:ping':
        await this.handleSystemPing(payload);
        break;
      case 'sms:received':
      case 'sms:data-received':
      case 'mms:received':
        // Handle incoming messages if needed
        logger.info({ event: payload.event }, 'Incoming message received');
        break;
      default:
        logger.warn({ event: payload.event }, 'Unknown webhook event');
    }
  }

  private async logWebhook(payload: SmsGateWebhookPayload): Promise<void> {
    try {
      await db.insert(webhookLogs).values({
        deviceId: payload.deviceId,
        eventType: payload.event,
        payload: payload as unknown as Record<string, unknown>,
        processed: true,
      } as NewWebhookLog);
    } catch (error) {
      logger.error({ error }, 'Failed to log webhook');
    }
  }

  private async handleSmsSent(payload: SmsGateWebhookPayload): Promise<void> {
    const messageId = payload.payload.messageId;
    if (!messageId) {
      logger.warn({ payload }, 'No messageId in sms:sent webhook');
      return;
    }

    logger.info({ messageId }, 'SMS sent confirmation received');
  }

  private async handleSmsDelivered(payload: SmsGateWebhookPayload): Promise<void> {
    const messageId = payload.payload.messageId;
    if (!messageId) {
      logger.warn({ payload }, 'No messageId in sms:delivered webhook');
      return;
    }

    const simNumber = payload.payload.simNumber;

    await messageService.handleDeliveryConfirmation(messageId, simNumber);
  }

  private async handleSmsFailed(payload: SmsGateWebhookPayload): Promise<void> {
    const messageId = payload.payload.messageId;
    if (!messageId) {
      logger.warn({ payload }, 'No messageId in sms:failed webhook');
      return;
    }

    const reason = payload.payload.reason || 'Unknown error';
    const simNumber = payload.payload.simNumber;

    await messageService.handleFailure(messageId, reason, simNumber);
  }

  private async handleSystemPing(payload: SmsGateWebhookPayload): Promise<void> {
    const deviceId = payload.deviceId;
    const health = payload.payload.health;

    logger.info({ deviceId, health }, 'System ping received');

    // Determine status from health checks
    let status: 'online' | 'offline' | 'error' = 'online';
    if (health?.status === 'fail') {
      status = 'error';
    } else if (health?.status === 'pass') {
      status = 'online';
    }

    // Extract health metrics
    const healthData = {
      batteryLevel: health?.checks?.['battery:level']?.observedValue as number | undefined,
      batteryCharging: health?.checks?.['battery:charging']?.observedValue === 1,
      connectionStatus: health?.checks?.['connection:status']?.observedValue === 1,
      failedMessages: health?.checks?.['messages:failed']?.observedValue as number | undefined,
      appVersion: health?.version as string | undefined,
    };

    await deviceService.updateDeviceHealth(
      deviceId, 
      status,
      new Date(),
      healthData
    );
  }
}

export const webhookService = new WebhookService();
