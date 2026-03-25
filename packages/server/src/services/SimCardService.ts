import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import { simCards, simUsageLogs, messages, type SimCard, type NewSimCard } from '../db/schema';
import { logger } from '../config/logger';
import { env } from '../config/env';
import type { SimConfig, SimCardStatus } from '../models/types';

export class SimCardService {
  async registerSimCards(deviceId: string, sims: SimConfig[]): Promise<SimCard[]> {
    logger.info({ deviceId, simCount: sims.length }, 'Registering SIM cards');

    const createdSims: SimCard[] = [];

    for (const sim of sims) {
      const result = await db.insert(simCards).values({
        deviceId,
        simNumber: sim.simNumber,
        phoneNumber: sim.phoneNumber,
        name: sim.name || `SIM ${sim.simNumber}`,
        totalSmsLimit: sim.totalSmsLimit || 0,
        dailySmsLimit: sim.dailySmsLimit || env.DEFAULT_DAILY_SMS_LIMIT,
      } as NewSimCard).returning();

      if (result[0]) {
        createdSims.push(result[0]);
      }
    }

    return createdSims;
  }

  async getSimCardsByDevice(deviceId: string): Promise<SimCard[]> {
    return await db.query.simCards.findMany({
      where: eq(simCards.deviceId, deviceId),
      orderBy: simCards.simNumber,
    });
  }

  async getSimCardById(id: string): Promise<SimCard | undefined> {
    return await db.query.simCards.findFirst({
      where: eq(simCards.id, id),
    });
  }

  async getSimCardByDeviceAndNumber(
    deviceId: string, 
    simNumber: number
  ): Promise<SimCard | undefined> {
    return await db.query.simCards.findFirst({
      where: and(
        eq(simCards.deviceId, deviceId),
        eq(simCards.simNumber, simNumber)
      ),
    });
  }

  async getAvailableSim(deviceId?: string): Promise<SimCard | null> {
    const query = deviceId 
      ? eq(simCards.deviceId, deviceId)
      : undefined;

    const allSims = await db.query.simCards.findMany({
      where: query,
      orderBy: simCards.simNumber,
    });

    logger.debug({ deviceId, simCount: allSims.length }, 'Checking available SIMs');

    for (const sim of allSims) {
      const canSend = await this.canSend(sim.id);
      logger.debug({ 
        simId: sim.id, 
        simNumber: sim.simNumber, 
        allowed: canSend.allowed, 
        reason: canSend.reason,
        remaining: sim.smsRemaining,
        dailySent: sim.dailySmsSent,
        dailyLimit: sim.dailySmsLimit
      }, 'SIM check');
      if (canSend.allowed) {
        return sim;
      }
    }

    return null;
  }

  async canSend(simCardId: string): Promise<{ allowed: boolean; reason?: string }> {
    const sim = await this.getSimCardById(simCardId);
    
    if (!sim) {
      return { allowed: false, reason: 'SIM card not found' };
    }

    if (!sim.isActive) {
      return { allowed: false, reason: 'SIM card is inactive' };
    }

    // Check total balance
    if (sim.totalSmsLimit > 0 && sim.smsRemaining <= 0) {
      return { allowed: false, reason: 'no_balance' };
    }

    // Check daily limit
    if (sim.dailySmsSent >= sim.dailySmsLimit) {
      return { allowed: false, reason: 'daily_limit_exceeded' };
    }

    return { allowed: true };
  }

  async updateBalance(simCardId: string, totalLimit: number): Promise<void> {
    const sim = await this.getSimCardById(simCardId);
    if (!sim) {
      throw new Error('SIM card not found');
    }

    const smsRemaining = totalLimit - sim.smsUsed;

    await db.update(simCards)
      .set({
        totalSmsLimit: totalLimit,
        smsRemaining: smsRemaining,
        status: 'active', // Reset status when balance is added
        updatedAt: new Date(),
      })
      .where(eq(simCards.id, simCardId));

    logger.info({ simCardId, totalLimit, smsRemaining }, 'SIM balance updated');
    
    // Trigger processing of queued messages
    await this.processQueuedMessages(sim.deviceId);
  }

  /**
   * Process queued messages when balance is added or daily limit resets
   */
  private async processQueuedMessages(deviceId: string): Promise<void> {
    const { messageService } = await import('./MessageService');
    
    logger.info({ deviceId }, 'Processing queued messages after balance/limit update');
    
    // Get queued messages for this device
    const queuedMessages = await db.query.messages.findMany({
      where: eq(messages.status, 'queued'),
      orderBy: desc(messages.priority),
      limit: 100,
    });

    if (queuedMessages.length === 0) {
      logger.info({ deviceId }, 'No queued messages to process');
      return;
    }

    logger.info({ deviceId, count: queuedMessages.length }, 'Found queued messages to process');

    // Process each queued message
    for (const message of queuedMessages) {
      try {
        // Reset message to pending so it can be processed
        await db.update(messages)
          .set({
            status: 'pending',
            failedReason: null,
            updatedAt: new Date(),
          })
          .where(eq(messages.id, message.id));
        
        logger.info({ messageId: message.id }, 'Queued message reset to pending');
      } catch (error) {
        logger.error({ error, messageId: message.id }, 'Failed to reset queued message');
      }
    }
  }

  async updateDailyLimit(simCardId: string, dailyLimit: number): Promise<void> {
    const sim = await this.getSimCardById(simCardId);
    
    await db.update(simCards)
      .set({
        dailySmsLimit: dailyLimit,
        updatedAt: new Date(),
      })
      .where(eq(simCards.id, simCardId));

    logger.info({ simCardId, dailyLimit }, 'SIM daily limit updated');
    
    // Trigger processing of queued messages if SIM has a device
    if (sim?.deviceId) {
      await this.processQueuedMessages(sim.deviceId);
    }
  }

  async updateSimStatus(
    simCardId: string, 
    status: SimCardStatus
  ): Promise<void> {
    await db.update(simCards)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(simCards.id, simCardId));

    logger.info({ simCardId, status }, 'SIM status updated');
  }

  async toggleSimActive(simCardId: string, isActive: boolean): Promise<void> {
    await db.update(simCards)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(simCards.id, simCardId));

    logger.info({ simCardId, isActive }, 'SIM active status updated');
  }

  async incrementUsage(
    simCardId: string,
    type: 'sent' | 'delivered' | 'failed'
  ): Promise<void> {
    const sim = await this.getSimCardById(simCardId);
    if (!sim) return;

    const updateData: Partial<SimCard> = {
      updatedAt: new Date(),
    };

    // Update usage counters
    if (type === 'sent') {
      updateData.smsUsed = sim.smsUsed + 1;
      updateData.smsRemaining = Math.max(0, sim.totalSmsLimit - (sim.smsUsed + 1));
      updateData.dailySmsSent = sim.dailySmsSent + 1;
      updateData.totalSent = sim.totalSent + 1;
    } else if (type === 'delivered') {
      updateData.totalDelivered = sim.totalDelivered + 1;
    } else if (type === 'failed') {
      updateData.totalFailed = sim.totalFailed + 1;
    }

    await db.update(simCards)
      .set(updateData)
      .where(eq(simCards.id, simCardId));

    // Update or create usage log for today
    await this.updateUsageLog(simCardId, type);

    logger.debug({ simCardId, type }, 'SIM usage incremented');
  }

  private async updateUsageLog(
    simCardId: string,
    type: 'sent' | 'delivered' | 'failed'
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    const existingLog = await db.query.simUsageLogs.findFirst({
      where: and(
        eq(simUsageLogs.simCardId, simCardId),
        eq(simUsageLogs.date, today as string)
      ),
    });

    if (existingLog) {
      const field = type === 'sent' 
        ? 'smsSent' 
        : type === 'delivered' 
          ? 'smsDelivered' 
          : 'smsFailed';

      const currentValue = field === 'smsSent' 
        ? existingLog.smsSent 
        : field === 'smsDelivered' 
          ? existingLog.smsDelivered 
          : existingLog.smsFailed;

      await db.update(simUsageLogs)
        .set({
          [field]: currentValue + 1,
          updatedAt: new Date(),
        })
        .where(eq(simUsageLogs.id, existingLog.id));
    } else {
      await db.insert(simUsageLogs).values({
        simCardId,
        date: today as string,
        smsSent: type === 'sent' ? 1 : 0,
        smsDelivered: type === 'delivered' ? 1 : 0,
        smsFailed: type === 'failed' ? 1 : 0,
      });
    }
  }

  async checkAndResetDailyLimits(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const simsToReset = await db.query.simCards.findMany({
      where: and(
        sql`${simCards.dailyResetAt} IS NULL OR ${simCards.dailyResetAt} < ${today}`,
        sql`${simCards.dailySmsSent} > 0`
      ),
    });

    const deviceIdsToProcess = new Set<string>();

    for (const sim of simsToReset) {
      await db.update(simCards)
        .set({
          dailySmsSent: 0,
          dailyResetAt: today,
          status: 'active', // Reset status when daily limit resets
          updatedAt: new Date(),
        })
        .where(eq(simCards.id, sim.id));

      logger.info({ simCardId: sim.id }, 'Daily SMS limit reset');
      
      // Collect device IDs to process queued messages
      const simData = await this.getSimCardById(sim.id);
      if (simData?.deviceId) {
        deviceIdsToProcess.add(simData.deviceId);
      }
    }

    logger.info({ count: simsToReset.length }, 'Daily limits reset completed');
    
    // Process queued messages for devices that had their limits reset
    for (const deviceId of deviceIdsToProcess) {
      await this.processQueuedMessages(deviceId);
    }
  }

  async getUsageStats(simCardId: string, days: number = 30): Promise<unknown[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    return await db.query.simUsageLogs.findMany({
      where: and(
        eq(simUsageLogs.simCardId, simCardId),
        sql`${simUsageLogs.date} >= ${startDateStr}`
      ),
      orderBy: simUsageLogs.date,
    });
  }
}

export const simCardService = new SimCardService();
