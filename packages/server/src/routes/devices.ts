import { deviceService } from '../services/DeviceService';
import { simCardService } from '../services/SimCardService';
import { logger } from '../config/logger';
import type { DeviceConfig } from '../models/types';

export async function handleDevices(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // POST /api/v1/devices - Register new device
  if (req.method === 'POST' && path === '/api/v1/devices') {
    try {
      const body = await req.json() as DeviceConfig;

      // Validate request
      if (!body.deviceId || typeof body.deviceId !== 'string') {
        return new Response(
          JSON.stringify({ error: 'deviceId is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!body.username || typeof body.username !== 'string') {
        return new Response(
          JSON.stringify({ error: 'username is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!body.password || typeof body.password !== 'string') {
        return new Response(
          JSON.stringify({ error: 'password is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const device = await deviceService.registerDevice(body);

      return new Response(
        JSON.stringify({
          success: true,
          data: device,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to register device');
      const errorMessage = error instanceof Error ? error.message : 'Failed to register device';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // GET /api/v1/devices - List all devices
  if (req.method === 'GET' && path === '/api/v1/devices') {
    try {
      const devices = await deviceService.getAllDevices();

      return new Response(
        JSON.stringify({
          success: true,
          data: devices,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to list devices');
      return new Response(
        JSON.stringify({ error: 'Failed to list devices' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // GET /api/v1/devices/:id - Get device
  if (req.method === 'GET' && path.startsWith('/api/v1/devices/')) {
    const parts = path.split('/');
    const id = parts[4];

    // Check if it's a SIMs sub-route
    if (parts[5] === 'sims' && id) {
      return handleDeviceSims(req, id);
    }

    try {
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Device ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const device = await deviceService.getDeviceById(id);

      if (!device) {
        return new Response(
          JSON.stringify({ error: 'Device not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: device,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to get device');
      return new Response(
        JSON.stringify({ error: 'Failed to get device' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // PATCH /api/v1/devices/:id - Update device
  if (req.method === 'PATCH' && path.startsWith('/api/v1/devices/')) {
    try {
      const id = path.split('/').pop();
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Device ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const body = await req.json() as Partial<{ name: string; username: string; password: string; isActive: boolean; priority: number; status: string }>;
      const device = await deviceService.updateDevice(id, body);

      return new Response(
        JSON.stringify({
          success: true,
          data: device,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to update device');
      const errorMessage = error instanceof Error ? error.message : 'Failed to update device';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // DELETE /api/v1/devices/:id - Delete device
  if (req.method === 'DELETE' && path.startsWith('/api/v1/devices/')) {
    try {
      const id = path.split('/').pop();
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Device ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      await deviceService.deleteDevice(id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Device deleted successfully',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to delete device');
      return new Response(
        JSON.stringify({ error: 'Failed to delete device' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Not found' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleDeviceSims(req: Request, deviceId: string): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: 'Device ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sims = await simCardService.getSimCardsByDevice(deviceId);

    return new Response(
      JSON.stringify({
        success: true,
        data: sims,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error({ error }, 'Failed to get device SIMs');
    return new Response(
      JSON.stringify({ error: 'Failed to get device SIMs' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
