import { env } from '../config/env';
import { logger } from '../config/logger';
import { deviceService } from '../services/DeviceService';
import { simCardService } from '../services/SimCardService';
import { messageService } from '../services/MessageService';

export class HealthCheckScheduler {
  private isRunning = false;
  private intervals: Timer[] = [];

  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    logger.info('Starting health check scheduler');
    this.isRunning = true;

    // Health check every 5 minutes (300000 ms)
    this.intervals.push(setInterval(async () => {
      if (!this.isRunning) return;
      await this.runHealthChecks();
    }, 5 * 60 * 1000));

    // Daily reset check every minute
    this.intervals.push(setInterval(async () => {
      if (!this.isRunning) return;
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        await this.runDailyReset();
      }
    }, 60 * 1000));

    // Queue processor every 10 seconds
    this.intervals.push(setInterval(async () => {
      if (!this.isRunning) return;
      await this.runQueueProcessor();
    }, 10 * 1000));

    // Run initial health check
    this.runHealthChecks();

    logger.info('Health check scheduler started');
  }

  stop(): void {
    logger.info('Stopping health check scheduler');
    this.isRunning = false;
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    logger.info('Health check scheduler stopped');
  }

  private async runHealthChecks(): Promise<void> {
    logger.info('Running device health checks');

    try {
      const devices = await deviceService.getAllDevices();

      for (const device of devices) {
        if (!device.isActive) continue;

        const health = await deviceService.checkDeviceHealth(device.deviceId);
        
        if (!health.isHealthy && device.status === 'online') {
          logger.warn({ 
            deviceId: device.deviceId, 
            reason: health.reason 
          }, 'Device marked as unhealthy');
          
          await deviceService.updateDeviceStatus(device.deviceId, 'offline');
        }
      }

      logger.info({ deviceCount: devices.length }, 'Health checks completed');
    } catch (error) {
      logger.error({ error }, 'Health check failed');
    }
  }

  private async runDailyReset(): Promise<void> {
    logger.info('Running daily SIM limit reset');

    try {
      await simCardService.checkAndResetDailyLimits();
      logger.info('Daily SIM limit reset completed');
    } catch (error) {
      logger.error({ error }, 'Daily reset failed');
    }
  }

  private async runQueueProcessor(): Promise<void> {
    try {
      await messageService.processQueue();
    } catch (error) {
      logger.error({ error }, 'Queue processor failed');
    }
  }
}

export const healthCheckScheduler = new HealthCheckScheduler();
