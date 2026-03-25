import { simCardService } from '../services/SimCardService';
import { logger } from '../config/logger';
import type { SimCardStatus } from '../models/types';

export async function handleSims(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // GET /api/v1/sims/:id - Get SIM details
  if (req.method === 'GET' && path.startsWith('/api/v1/sims/') && !path.includes('/usage')) {
    try {
      const id = path.split('/').pop();
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'SIM ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const sim = await simCardService.getSimCardById(id);

      if (!sim) {
        return new Response(
          JSON.stringify({ error: 'SIM card not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: sim,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to get SIM');
      return new Response(
        JSON.stringify({ error: 'Failed to get SIM' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // GET /api/v1/sims/:id/usage - Get SIM usage statistics
  if (req.method === 'GET' && path.includes('/usage')) {
    try {
      const parts = path.split('/');
      const id = parts[4];
      
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'SIM ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const days = parseInt(url.searchParams.get('days') || '30');
      const stats = await simCardService.getUsageStats(id, days);

      return new Response(
        JSON.stringify({
          success: true,
          data: stats,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to get SIM usage');
      return new Response(
        JSON.stringify({ error: 'Failed to get SIM usage' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // PATCH /api/v1/sims/:id/balance - Update total SMS balance
  if (req.method === 'PATCH' && path.includes('/balance')) {
    try {
      const parts = path.split('/');
      const id = parts[4];
      
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'SIM ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const body = await req.json() as { totalLimit: number };
      
      if (typeof body.totalLimit !== 'number' || body.totalLimit < 0) {
        return new Response(
          JSON.stringify({ error: 'totalLimit must be a positive number' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      await simCardService.updateBalance(id, body.totalLimit);

      const sim = await simCardService.getSimCardById(id);

      return new Response(
        JSON.stringify({
          success: true,
          data: sim,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to update SIM balance');
      const errorMessage = error instanceof Error ? error.message : 'Failed to update SIM balance';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // PATCH /api/v1/sims/:id/daily-limit - Update daily limit
  if (req.method === 'PATCH' && path.includes('/daily-limit')) {
    try {
      const parts = path.split('/');
      const id = parts[4];
      
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'SIM ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const body = await req.json() as { dailyLimit: number };
      
      if (typeof body.dailyLimit !== 'number' || body.dailyLimit < 1) {
        return new Response(
          JSON.stringify({ error: 'dailyLimit must be at least 1' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      await simCardService.updateDailyLimit(id, body.dailyLimit);

      const sim = await simCardService.getSimCardById(id);

      return new Response(
        JSON.stringify({
          success: true,
          data: sim,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to update SIM daily limit');
      const errorMessage = error instanceof Error ? error.message : 'Failed to update SIM daily limit';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // PATCH /api/v1/sims/:id/status - Enable/disable SIM
  if (req.method === 'PATCH' && path.endsWith('/status')) {
    try {
      const parts = path.split('/');
      const id = parts[4];
      
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'SIM ID is required' }),
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

      await simCardService.toggleSimActive(id, body.isActive);

      const sim = await simCardService.getSimCardById(id);

      return new Response(
        JSON.stringify({
          success: true,
          data: sim,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to update SIM status');
      const errorMessage = error instanceof Error ? error.message : 'Failed to update SIM status';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Not found' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}
