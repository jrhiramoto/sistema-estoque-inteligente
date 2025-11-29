import { z } from 'zod';
import { publicProcedure, router } from './_core/trpc';
import { TRPCError } from '@trpc/server';
import * as webhookService from './webhookService';
import * as db from './db';

/**
 * Router para webhooks do Bling
 * 
 * Nota: O endpoint POST /api/webhooks/bling será criado separadamente
 * como uma rota Express, pois webhooks precisam de acesso ao body raw
 * para validação HMAC-SHA256
 */

export const webhookRouter = router({
  /**
   * Obter estatísticas de webhooks recebidos
   */
  getStats: publicProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(7),
    }))
    .query(async ({ input }) => {
      const stats = await db.getWebhookStats(input.days);
      return stats || {
        total: 0,
        processed: 0,
        failed: 0,
        successRate: '0',
        byResource: {},
        byAction: {},
      };
    }),
  
  /**
   * Obter webhooks recentes
   */
  getRecent: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const webhooks = await db.getRecentWebhooks(input.limit);
      return webhooks.map(webhook => ({
        ...webhook,
        payload: undefined, // Não enviar payload completo para o frontend
        payloadPreview: JSON.parse(webhook.payload).data?.nome || 
                        JSON.parse(webhook.payload).data?.id ||
                        'N/A',
      }));
    }),
  
  /**
   * Obter detalhes de um webhook específico
   */
  getById: publicProcedure
    .input(z.object({
      eventId: z.string(),
    }))
    .query(async ({ input }) => {
      const webhooks = await db.getRecentWebhooks(1000);
      const webhook = webhooks.find(w => w.eventId === input.eventId);
      
      if (!webhook) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Webhook not found',
        });
      }
      
      return {
        ...webhook,
        payloadParsed: JSON.parse(webhook.payload),
      };
    }),
});
