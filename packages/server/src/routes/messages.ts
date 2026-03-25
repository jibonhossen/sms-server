import { messageService } from '../services/MessageService';
import { logger } from '../config/logger';
import type { SendMessageRequest } from '../models/types';

export async function handleMessages(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // POST /api/v1/messages - Send SMS
  if (req.method === 'POST' && path === '/api/v1/messages') {
    try {
      const body = await req.json() as SendMessageRequest;
      
      // Validate request
      if (!body.phoneNumbers || !Array.isArray(body.phoneNumbers) || body.phoneNumbers.length === 0) {
        return new Response(
          JSON.stringify({ error: 'phoneNumbers array is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!body.textContent || typeof body.textContent !== 'string') {
        return new Response(
          JSON.stringify({ error: 'textContent is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const message = await messageService.enqueueMessage(body);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: message.id,
            status: message.status,
            phoneNumbers: message.phoneNumbers,
            createdAt: message.createdAt,
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to enqueue message');
      return new Response(
        JSON.stringify({ error: 'Failed to enqueue message' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // GET /api/v1/messages - List messages
  if (req.method === 'GET' && path === '/api/v1/messages') {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      
      const messages = await messageService.getAllMessages(limit, offset);

      return new Response(
        JSON.stringify({
          success: true,
          data: messages,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to list messages');
      return new Response(
        JSON.stringify({ error: 'Failed to list messages' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // GET /api/v1/messages/:id - Get message status
  if (req.method === 'GET' && path.startsWith('/api/v1/messages/')) {
    try {
      const id = path.split('/').pop();
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Message ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const message = await messageService.getMessageById(id);
      
      if (!message) {
        return new Response(
          JSON.stringify({ error: 'Message not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: message,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error({ error }, 'Failed to get message');
      return new Response(
        JSON.stringify({ error: 'Failed to get message' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Not found' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}
