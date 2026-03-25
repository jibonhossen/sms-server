import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { webhooks, type Webhook, type NewWebhook } from '../db/schema';
import { logger } from '../config/logger';
import { smsGateClient } from './SmsGateClient';
import { deviceService } from './DeviceService';
import type { Device } from '../db/schema';

export interface RegisterWebhookRequest {
  url: string;
  event: string;
}

export interface SmsGateWebhookRegistration {
  id: string;
  url: string;
  event: string;
  device_id?: string;
}

export class WebhookManagerService {
  /**
   * Register a new webhook for a device
   */
  async registerWebhook(
    device: Device,
    request: RegisterWebhookRequest
  ): Promise<Webhook> {
    logger.info({
      deviceId: device.deviceId,
      event: request.event,
      url: request.url,
    }, 'Registering webhook');

    // Register with SMS-Gate API and get the webhook ID
    const smsGateResponse = await this.registerWithSmsGate(device, request);
    const smsGateWebhookId = smsGateResponse.id;

    // Store in database with the SMS-Gate webhook ID
    const result = await db.insert(webhooks).values({
      deviceId: device.id,
      webhookId: smsGateWebhookId,
      url: request.url,
      event: request.event,
      isActive: true,
    } as NewWebhook).returning();

    const webhook = result[0];
    if (!webhook) {
      throw new Error('Failed to create webhook');
    }

    logger.info({
      webhookId: webhook.id,
      smsGateWebhookId: smsGateWebhookId,
    }, 'Webhook registered successfully');

    return webhook;
  }

  /**
   * Register webhook with SMS-Gate API
   */
  private async registerWithSmsGate(
    device: Device,
    request: RegisterWebhookRequest
  ): Promise<{ id: string }> {
    try {
      // Use the smsGateClient to register the webhook and get the SMS-Gate webhook ID
      const response = await smsGateClient.registerWebhook(device, request.url, request.event);
      
      return response;
    } catch (error) {
      logger.error({ error, deviceId: device.deviceId }, 'Failed to register webhook with SMS-Gate');
      throw error;
    }
  }

  /**
   * Get all webhooks for a device
   */
  async getWebhooksByDevice(deviceId: string): Promise<Webhook[]> {
    return await db.query.webhooks.findMany({
      where: eq(webhooks.deviceId, deviceId),
      orderBy: webhooks.createdAt,
    });
  }

  /**
   * Get a single webhook by ID
   */
  async getWebhookById(id: string): Promise<Webhook | undefined> {
    return await db.query.webhooks.findFirst({
      where: eq(webhooks.id, id),
    });
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(device: Device, webhookId: string): Promise<void> {
    logger.info({ webhookId }, 'Deleting webhook');

    // Find the webhook
    const webhook = await db.query.webhooks.findFirst({
      where: and(
        eq(webhooks.deviceId, device.id),
        eq(webhooks.webhookId, webhookId)
      ),
    });

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    // Delete from SMS-Gate API
    try {
      await this.deleteFromSmsGate(device, webhookId);
    } catch (error) {
      logger.error({ error, webhookId }, 'Failed to delete webhook from SMS-Gate');
      // Continue to delete from database even if SMS-Gate deletion fails
    }

    // Delete from database
    await db.delete(webhooks).where(eq(webhooks.id, webhook.id));

    logger.info({ webhookId }, 'Webhook deleted successfully');
  }

  /**
   * Delete webhook from SMS-Gate API
   */
  private async deleteFromSmsGate(device: Device, webhookId: string): Promise<void> {
    await smsGateClient.deleteWebhook(device, webhookId);
  }

  /**
   * List webhooks from SMS-Gate API
   */
  async listWebhooksFromSmsGate(device: Device): Promise<unknown[]> {
    try {
      return await smsGateClient.listWebhooks(device);
    } catch (error) {
      logger.error({ error, deviceId: device.deviceId }, 'Failed to list webhooks from SMS-Gate');
      throw error;
    }
  }

  /**
   * Sync webhooks from SMS-Gate API to database
   */
  async syncWebhooks(device: Device): Promise<void> {
    logger.info({ deviceId: device.deviceId }, 'Syncing webhooks from SMS-Gate');

    try {
      const remoteWebhooks = await this.listWebhooksFromSmsGate(device);
      
      // TODO: Implement sync logic to match remote webhooks with database
      logger.info({ 
        deviceId: device.deviceId, 
        count: remoteWebhooks.length 
      }, 'Webhooks synced');
    } catch (error) {
      logger.error({ error, deviceId: device.deviceId }, 'Failed to sync webhooks');
    }
  }

  /**
   * Update webhook last triggered timestamp
   */
  async updateLastTriggered(webhookId: string): Promise<void> {
    await db.update(webhooks)
      .set({
        lastTriggeredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhooks.id, webhookId));
  }

  /**
   * Toggle webhook active status
   */
  async toggleWebhookStatus(webhookId: string, isActive: boolean): Promise<void> {
    await db.update(webhooks)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(webhooks.id, webhookId));

    logger.info({ webhookId, isActive }, 'Webhook status updated');
  }

  /**
   * Get supported webhook events
   */
  getSupportedEvents(): { value: string; label: string; description: string }[] {
    return [
      { 
        value: 'sms:received', 
        label: 'SMS Received', 
        description: 'Triggered when the device receives an SMS' 
      },
      { 
        value: 'sms:sent', 
        label: 'SMS Sent', 
        description: 'Triggered when an SMS is sent from the device' 
      },
      { 
        value: 'sms:delivered', 
        label: 'SMS Delivered', 
        description: 'Triggered when an SMS is delivered to the recipient' 
      },
      { 
        value: 'sms:failed', 
        label: 'SMS Failed', 
        description: 'Triggered when an SMS fails to send' 
      },
      { 
        value: 'system:ping', 
        label: 'System Ping', 
        description: 'Triggered periodically for health checks' 
      },
    ];
  }
}

export const webhookManagerService = new WebhookManagerService();
