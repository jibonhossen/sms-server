import { env } from '../config/env';
import { logger } from '../config/logger';
import type { Device } from '../db/schema';

export interface SmsGateSendRequest {
  textMessage: {
    text: string;
  };
  phoneNumbers: string[];
  simNumber?: number;
  deviceId?: string;
  priority?: number;
  ttl?: number;
}

export interface SmsGateSendResponse {
  id: string;
  state: string;
  message?: string;
}

export class SmsGateClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.SMS_GATE_CLOUD_URL;
  }

  async sendSMS(
    device: Device,
    request: SmsGateSendRequest
  ): Promise<SmsGateSendResponse> {
    const url = `${this.baseUrl}/messages`;
    
    const payload: SmsGateSendRequest = {
      textMessage: request.textMessage,
      phoneNumbers: request.phoneNumbers,
      ...(request.simNumber && { simNumber: request.simNumber }),
      ...(request.deviceId && { deviceId: request.deviceId }),
      ...(request.priority && { priority: request.priority }),
      ...(request.ttl && { ttl: request.ttl }),
    };

    logger.info({ 
      deviceId: device.deviceId, 
      simNumber: request.simNumber,
      phoneNumbers: request.phoneNumbers 
    }, 'Sending SMS via SMS-Gate API');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${device.username}:${device.password}`).toString('base64')}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ 
          status: response.status, 
          error: errorText,
          deviceId: device.deviceId 
        }, 'SMS-Gate API error');
        throw new Error(`SMS-Gate API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as SmsGateSendResponse;
      
      logger.info({ 
        deviceId: device.deviceId,
        messageId: data.id,
        state: data.state 
      }, 'SMS sent successfully');

      return data;
    } catch (error) {
      logger.error({ 
        error, 
        deviceId: device.deviceId 
      }, 'Failed to send SMS');
      throw error;
    }
  }

  async registerWebhook(
    device: Device,
    webhookUrl: string,
    event: string
  ): Promise<{ id: string }> {
    const url = `${this.baseUrl}/webhooks`;
    
    const payload = {
      url: webhookUrl,
      event: event,
    };

    logger.info({ 
      deviceId: device.deviceId, 
      webhookUrl, 
      event 
    }, 'Registering webhook');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${device.username}:${device.password}`).toString('base64')}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ 
          status: response.status, 
          error: errorText 
        }, 'Failed to register webhook');
        throw new Error(`Webhook registration failed: ${response.status}`);
      }

      // Parse the response to get the webhook ID
      const data = await response.json() as { id: string };
      
      logger.info({ 
        deviceId: device.deviceId, 
        webhookId: data.id 
      }, 'Webhook registered successfully');
      
      return data;
    } catch (error) {
      logger.error({ error }, 'Failed to register webhook');
      throw error;
    }
  }

  async listWebhooks(device: Device): Promise<unknown[]> {
    const url = `${this.baseUrl}/webhooks`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${device.username}:${device.password}`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list webhooks: ${response.status}`);
      }

      return await response.json() as unknown[];
    } catch (error) {
      logger.error({ error }, 'Failed to list webhooks');
      throw error;
    }
  }

  async deleteWebhook(device: Device, webhookId: string): Promise<void> {
    const url = `${this.baseUrl}/webhooks/${webhookId}`;

    logger.info({ 
      deviceId: device.deviceId, 
      webhookId 
    }, 'Deleting webhook from SMS-Gate');

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${device.username}:${device.password}`).toString('base64')}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        const errorText = await response.text();
        logger.error({ 
          status: response.status, 
          error: errorText 
        }, 'Failed to delete webhook');
        throw new Error(`Webhook deletion failed: ${response.status}`);
      }

      logger.info({ deviceId: device.deviceId, webhookId }, 'Webhook deleted successfully from SMS-Gate');
    } catch (error) {
      logger.error({ error }, 'Failed to delete webhook from SMS-Gate');
      throw error;
    }
  }
}

export const smsGateClient = new SmsGateClient();
