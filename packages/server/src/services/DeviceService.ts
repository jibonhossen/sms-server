import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { devices, simCards, type Device, type NewDevice } from '../db/schema';
import { logger } from '../config/logger';
import { env } from '../config/env';
import type { DeviceConfig, DeviceStatus, HealthStatus, SimConfig } from '../models/types';

export class DeviceService {
  async registerDevice(config: DeviceConfig): Promise<Device> {
    logger.info({ deviceId: config.deviceId }, 'Registering new device');

    // Check if device already exists
    const existing = await db.query.devices.findFirst({
      where: eq(devices.deviceId, config.deviceId),
    });

    if (existing) {
      throw new Error(`Device with ID ${config.deviceId} already exists`);
    }

    // Create device
    const result = await db.insert(devices).values({
      deviceId: config.deviceId,
      name: config.name || config.deviceId,
      username: config.username,
      password: config.password,
      priority: config.priority || 5,
    } as NewDevice).returning();

    const device = result[0];
    if (!device) {
      throw new Error('Failed to create device');
    }

    // Auto-create 2 SIM cards for the device
    await this.createDefaultSimCards(device.id);

    logger.info({ deviceId: device.deviceId }, 'Device registered successfully');

    return device;
  }

  private async createDefaultSimCards(deviceId: string): Promise<void> {
    const defaultSims: SimConfig[] = [
      { simNumber: 1, name: 'SIM 1' },
      { simNumber: 2, name: 'SIM 2' },
    ];

    for (const sim of defaultSims) {
      await db.insert(simCards).values({
        deviceId,
        simNumber: sim.simNumber,
        name: sim.name,
        dailySmsLimit: env.DEFAULT_DAILY_SMS_LIMIT,
      });
    }

    logger.info({ deviceId }, 'Created default SIM cards');
  }

  async getAllDevices(): Promise<Device[]> {
    return await db.query.devices.findMany({
      orderBy: desc(devices.priority),
    });
  }

  async getDeviceById(id: string): Promise<Device | undefined> {
    return await db.query.devices.findFirst({
      where: eq(devices.id, id),
    });
  }

  async getDeviceByDeviceId(deviceId: string): Promise<Device | undefined> {
    return await db.query.devices.findFirst({
      where: eq(devices.deviceId, deviceId),
    });
  }

  async getAvailableDevice(): Promise<Device | null> {
    const allDevices = await db.query.devices.findMany({
      where: eq(devices.isActive, true),
      orderBy: desc(devices.priority),
    });

    for (const device of allDevices) {
      if (device.status === 'online') {
        return device;
      }
    }

    // If no online device, return first active device (will be checked later)
    return allDevices[0] || null;
  }

  async updateDeviceStatus(
    deviceId: string, 
    status: DeviceStatus,
    pingTime?: Date
  ): Promise<void> {
    const updateData: Partial<Device> = {
      status,
      updatedAt: new Date(),
    };

    if (pingTime) {
      updateData.lastPingAt = pingTime;
      updateData.lastSeenAt = pingTime;
    }

    await db.update(devices)
      .set(updateData)
      .where(eq(devices.deviceId, deviceId));

    logger.info({ deviceId, status }, 'Device status updated');
  }

  async updateDeviceHealth(
    deviceId: string,
    status: 'online' | 'offline' | 'error',
    pingTime: Date,
    healthData: {
      batteryLevel?: number;
      batteryCharging?: boolean;
      connectionStatus?: boolean;
      failedMessages?: number;
      appVersion?: string;
    }
  ): Promise<void> {
    const updateData: Partial<Device> = {
      status,
      lastPingAt: pingTime,
      lastSeenAt: pingTime,
      batteryLevel: healthData.batteryLevel,
      batteryCharging: healthData.batteryCharging,
      connectionStatus: healthData.connectionStatus,
      failedMessagesHour: healthData.failedMessages,
      appVersion: healthData.appVersion,
      updatedAt: new Date(),
    };

    await db.update(devices)
      .set(updateData)
      .where(eq(devices.deviceId, deviceId));

    logger.info({ 
      deviceId, 
      status, 
      batteryLevel: healthData.batteryLevel,
      appVersion: healthData.appVersion 
    }, 'Device health updated');
  }

  async updateDevice(id: string, updates: Partial<Device>): Promise<Device> {
    const [updated] = await db.update(devices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(devices.id, id))
      .returning();

    if (!updated) {
      throw new Error(`Device with ID ${id} not found`);
    }

    return updated;
  }

  async deleteDevice(id: string): Promise<void> {
    await db.delete(devices).where(eq(devices.id, id));
    logger.info({ deviceId: id }, 'Device deleted');
  }

  async checkDeviceHealth(deviceId: string): Promise<HealthStatus> {
    const device = await this.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return { isHealthy: false, reason: 'Device not found' };
    }

    if (!device.isActive) {
      return { isHealthy: false, reason: 'Device is inactive' };
    }

    if (device.status === 'offline') {
      return { isHealthy: false, reason: 'Device is offline' };
    }

    // Check last ping time
    if (device.lastPingAt) {
      const timeSinceLastPing = Date.now() - device.lastPingAt.getTime();
      if (timeSinceLastPing > env.DEVICE_OFFLINE_THRESHOLD_MS) {
        return { 
          isHealthy: false, 
          lastSeen: device.lastPingAt,
          reason: 'Device has not pinged recently' 
        };
      }
    }

    return { 
      isHealthy: true, 
      lastSeen: device.lastPingAt || undefined 
    };
  }

  async incrementDeviceStats(
    deviceId: string, 
    type: 'sent' | 'failed'
  ): Promise<void> {
    const field = type === 'sent' ? 'totalSent' : 'totalFailed';
    
    const currentDevice = await this.getDeviceByDeviceId(deviceId);
    if (!currentDevice) return;

    const currentValue = type === 'sent' ? currentDevice.totalSent : currentDevice.totalFailed;
    
    await db.update(devices)
      .set({
        [field]: currentValue + 1,
        updatedAt: new Date(),
      })
      .where(eq(devices.deviceId, deviceId));
  }
}

export const deviceService = new DeviceService();
