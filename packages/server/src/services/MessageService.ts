import { eq, desc, and, inArray } from 'drizzle-orm';
import { db } from '../db';
import { messages, type Message, type NewMessage } from '../db/schema';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { smsGateClient } from './SmsGateClient';
import { deviceService } from './DeviceService';
import { simCardService } from './SimCardService';
import type { SendMessageRequest, MessageStatus, FailedReason } from '../models/types';

export class MessageService {
  /**
   * Format phone number to international format with + prefix
   * Handles Bangladesh numbers (starting with 01) and other formats
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If already has + prefix, return as-is
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    // Remove leading 0 if present
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // If starts with 1 (Bangladesh mobile), add +880
    if (cleaned.startsWith('1') && cleaned.length === 10) {
      return `+880${cleaned}`;
    }
    
    // If starts with country code without +, add +
    if (/^\d{11,15}$/.test(cleaned)) {
      return `+${cleaned}`;
    }
    
    // Default: add + prefix
    return `+${cleaned}`;
  }

  async enqueueMessage(request: SendMessageRequest): Promise<Message> {
    // Format all phone numbers to international format
    const formattedPhoneNumbers = request.phoneNumbers.map(phone => 
      this.formatPhoneNumber(phone)
    );

    logger.info({ 
      originalNumbers: request.phoneNumbers,
      formattedNumbers: formattedPhoneNumbers,
      externalId: request.externalId 
    }, 'Enqueueing message');

    const result = await db.insert(messages).values({
      externalId: request.externalId,
      phoneNumbers: formattedPhoneNumbers,
      textContent: request.textContent,
      priority: request.priority || 5,
      status: 'pending',
      maxRetries: env.MAX_RETRY_ATTEMPTS,
    } as NewMessage).returning();

    const message = result[0];
    if (!message) {
      throw new Error('Failed to create message');
    }

    logger.info({ messageId: message.id }, 'Message enqueued');
    return message;
  }

  async getMessageById(id: string): Promise<Message | undefined> {
    return await db.query.messages.findFirst({
      where: eq(messages.id, id),
    });
  }

  async getMessagesByStatus(status: MessageStatus): Promise<Message[]> {
    return await db.query.messages.findMany({
      where: eq(messages.status, status),
      orderBy: [desc(messages.priority), desc(messages.createdAt)],
    });
  }

  async getPendingMessages(limit: number = 100): Promise<Message[]> {
    return await db.query.messages.findMany({
      where: inArray(messages.status, ['pending', 'queued']),
      orderBy: [desc(messages.priority), desc(messages.createdAt)],
      limit,
    });
  }

  async processQueue(): Promise<void> {
    const pendingMessages = await this.getPendingMessages(10);

    for (const message of pendingMessages) {
      try {
        await this.processMessage(message.id);
      } catch (error) {
        logger.error({ error, messageId: message.id }, 'Failed to process message');
      }
    }
  }

  async processMessage(messageId: string): Promise<void> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      logger.error({ messageId }, 'Message not found');
      return;
    }

    if (message.status !== 'pending' && message.status !== 'queued') {
      return;
    }

    // Update status to queued
    await this.updateStatus(messageId, 'queued');

    // Find available device and SIM
    const assignment = await this.assignToDeviceAndSim(messageId);
    
    if (!assignment) {
      logger.warn({ messageId }, 'No available device or SIM found');
      await this.updateStatus(messageId, 'pending');
      return;
    }

    const { device, simCard } = assignment;

    if (!device || !simCard) {
      logger.warn({ messageId }, 'Device or SIM not available');
      await this.updateStatus(messageId, 'pending');
      return;
    }

    // Check if SIM can send
    const canSend = await simCardService.canSend(simCard.id);
    if (!canSend.allowed) {
      logger.warn({ 
        messageId, 
        simCardId: simCard.id, 
        reason: canSend.reason 
      }, 'SIM cannot send');

      // Mark SIM with appropriate status
      if (canSend.reason === 'no_balance') {
        await simCardService.updateSimStatus(simCard.id, 'no_balance');
      } else if (canSend.reason === 'daily_limit_exceeded') {
        await simCardService.updateSimStatus(simCard.id, 'paused');
      }

      // Check if there are other available SIMs/devices
      const hasOtherSims = await this.hasAvailableSimForMessage(messageId);
      
      if (hasOtherSims) {
        // Retry with different SIM/device
        await this.handleRetry(message, canSend.reason as FailedReason);
      } else {
        // No available SIMs - keep message queued for later when balance is added
        logger.info({ 
          messageId, 
          reason: canSend.reason 
        }, 'No available SIMs - message kept in queue for later processing');
        
        // Update message status to 'queued' with the failed reason
        await this.updateStatus(messageId, 'queued', { 
          failedReason: canSend.reason as FailedReason 
        });
      }
      return;
    }

    try {
      // Update message with device and SIM assignment
      await db.update(messages)
        .set({
          deviceId: device.deviceId,
          simCardId: simCard.id,
          simNumber: simCard.simNumber,
          status: 'sending',
          updatedAt: new Date(),
        })
        .where(eq(messages.id, messageId));

      // Send via SMS-Gate API
      const response = await smsGateClient.sendSMS(device, {
        textMessage: { text: message.textContent },
        phoneNumbers: message.phoneNumbers,
        simNumber: simCard.simNumber,
        priority: message.priority >= 100 ? message.priority : undefined,
      });

      // Update message with SMS-Gate message ID
      await db.update(messages)
        .set({
          smsGateMessageId: response.id,
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(messages.id, messageId));

      // Increment SIM usage
      await simCardService.incrementUsage(simCard.id, 'sent');
      await deviceService.incrementDeviceStats(device.deviceId, 'sent');

      logger.info({ 
        messageId, 
        smsGateMessageId: response.id,
        deviceId: device.deviceId,
        simNumber: simCard.simNumber 
      }, 'Message sent to SMS-Gate');

    } catch (error) {
      logger.error({ error, messageId }, 'Failed to send message');
      await this.handleRetry(message, 'api_error');
    }
  }

  async assignToDeviceAndSim(
    messageId: string
  ): Promise<{ device: Awaited<ReturnType<typeof deviceService.getAvailableDevice>>; simCard: Awaited<ReturnType<typeof simCardService.getAvailableSim>> } | null> {
    const message = await this.getMessageById(messageId);
    if (!message) return null;

    // If specific device requested
    if (message.deviceId) {
      const device = await deviceService.getDeviceByDeviceId(message.deviceId);

      if (device && device.isActive) {
        // If specific SIM requested
        if (message.simNumber) {
          const simCard = await simCardService.getSimCardByDeviceAndNumber(
            device.id,
            message.simNumber
          );
          if (simCard && simCard.isActive) {
            const canSend = await simCardService.canSend(simCard.id);
            if (canSend.allowed) {
              logger.info({ messageId, deviceId: device.deviceId, simNumber: simCard.simNumber }, 'Assigned to specific SIM');
              return { device, simCard };
            }
          }
        }

        // Try any available SIM on this device
        const simCard = await simCardService.getAvailableSim(device.id);
        if (simCard) {
          logger.info({ messageId, deviceId: device.deviceId, simNumber: simCard.simNumber }, 'Assigned to available SIM on requested device');
          return { device, simCard };
        }

        logger.warn({ messageId, deviceId: device.deviceId }, 'No available SIM on requested device, falling back to other devices');
      } else {
        logger.warn({ messageId, deviceId: message.deviceId }, 'Requested device not found or inactive, falling back to other devices');
      }
    }

    // Find any available device with available SIM
    const allDevices = await deviceService.getAllDevices();
    logger.debug({ messageId, deviceCount: allDevices.length }, 'Searching for available device/SIM');
    
    for (const device of allDevices) {
      if (!device.isActive) {
        logger.debug({ messageId, deviceId: device.deviceId }, 'Device inactive, skipping');
        continue;
      }

      const simCard = await simCardService.getAvailableSim(device.id);
      if (simCard) {
        logger.info({ messageId, deviceId: device.deviceId, simNumber: simCard.simNumber }, 'Found available device/SIM');
        return { device, simCard };
      }
      logger.debug({ messageId, deviceId: device.deviceId }, 'No available SIM on device');
    }

    logger.warn({ messageId }, 'No available device or SIM found across all devices');
    return null;
  }

  /**
   * Check if there are any available SIMs for a message (excluding already tried ones)
   */
  private async hasAvailableSimForMessage(messageId: string): Promise<boolean> {
    const message = await this.getMessageById(messageId);
    if (!message) return false;

    const allDevices = await deviceService.getAllDevices();
    
    for (const device of allDevices) {
      if (!device.isActive) continue;

      // Skip if this device was already tried (we'd need to track this)
      const simCard = await simCardService.getAvailableSim(device.id);
      if (simCard) {
        return true;
      }
    }

    return false;
  }

  async updateStatus(
    messageId: string, 
    status: MessageStatus, 
    metadata?: { errorMessage?: string; failedReason?: FailedReason }
  ): Promise<void> {
    const updateData: Partial<Message> = {
      status,
      updatedAt: new Date(),
    };

    if (metadata?.errorMessage) {
      updateData.errorMessage = metadata.errorMessage;
    }

    if (metadata?.failedReason) {
      updateData.failedReason = metadata.failedReason;
    }

    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    }

    if (status === 'failed') {
      updateData.failedAt = new Date();
    }

    await db.update(messages)
      .set(updateData)
      .where(eq(messages.id, messageId));

    logger.debug({ messageId, status }, 'Message status updated');
  }

  async handleDeliveryConfirmation(
    smsGateMessageId: string, 
    simNumber?: number
  ): Promise<void> {
    const message = await db.query.messages.findFirst({
      where: eq(messages.smsGateMessageId, smsGateMessageId),
    });

    if (!message) {
      logger.warn({ smsGateMessageId }, 'Message not found for delivery confirmation');
      return;
    }

    await this.updateStatus(message.id, 'delivered');

    if (message.simCardId) {
      await simCardService.incrementUsage(message.simCardId, 'delivered');
    }

    logger.info({ messageId: message.id, smsGateMessageId }, 'Message delivered');
  }

  async handleFailure(
    smsGateMessageId: string, 
    reason: string,
    simNumber?: number
  ): Promise<void> {
    const message = await db.query.messages.findFirst({
      where: eq(messages.smsGateMessageId, smsGateMessageId),
    });

    if (!message) {
      logger.warn({ smsGateMessageId }, 'Message not found for failure handling');
      return;
    }

    await this.updateStatus(message.id, 'failed', { 
      errorMessage: reason,
      failedReason: 'api_error'
    });

    if (message.simCardId) {
      await simCardService.incrementUsage(message.simCardId, 'failed');
    }

    // Retry if possible
    await this.handleRetry(message, 'api_error');

    logger.info({ messageId: message.id, smsGateMessageId, reason }, 'Message failed');
  }

  private async handleRetry(
    message: Message, 
    failedReason: FailedReason
  ): Promise<void> {
    if (message.retryCount >= message.maxRetries) {
      logger.warn({ messageId: message.id }, 'Max retries exceeded');
      await this.updateStatus(message.id, 'failed', { failedReason });
      return;
    }

    // Increment retry count and reset to pending
    await db.update(messages)
      .set({
        retryCount: message.retryCount + 1,
        status: 'pending',
        failedReason,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, message.id));

    logger.info({ 
      messageId: message.id, 
      retryCount: message.retryCount + 1 
    }, 'Message queued for retry');
  }

  async getAllMessages(limit: number = 100, offset: number = 0): Promise<Message[]> {
    return await db.query.messages.findMany({
      orderBy: desc(messages.createdAt),
      limit,
      offset,
    });
  }
}

export const messageService = new MessageService();
