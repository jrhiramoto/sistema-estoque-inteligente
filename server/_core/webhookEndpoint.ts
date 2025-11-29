import { Router, Request, Response } from 'express';
import * as webhookService from '../webhookService';

/**
 * Endpoint Express para receber webhooks do Bling
 * 
 * Precisa ser uma rota Express separada (não tRPC) porque:
 * 1. Precisamos do body raw (string) para validação HMAC-SHA256
 * 2. Precisamos responder rapidamente (< 5s) sem processamento pesado
 * 3. Processamento será assíncrono (não bloquear resposta)
 */

export const webhookEndpoint = Router();

// Middleware para capturar body raw (necessário para HMAC)
webhookEndpoint.use('/api/webhooks/bling', (req, res, next) => {
  let rawBody = '';
  
  req.on('data', (chunk) => {
    rawBody += chunk.toString();
  });
  
  req.on('end', () => {
    (req as any).rawBody = rawBody;
    next();
  });
});

/**
 * POST /api/webhooks/bling
 * Recebe webhooks do Bling
 */
webhookEndpoint.post('/api/webhooks/bling', async (req: Request, res: Response) => {
  console.log('[Webhook] Received webhook from Bling');
  
  try {
    // Obter signature do header
    const signature = req.headers['x-bling-signature-256'] as string;
    if (!signature) {
      console.error('[Webhook] Missing X-Bling-Signature-256 header');
      return res.status(401).json({
        success: false,
        error: 'Missing signature header',
      });
    }
    
    // Obter body raw
    const rawBody = (req as any).rawBody as string;
    if (!rawBody) {
      console.error('[Webhook] Missing request body');
      return res.status(400).json({
        success: false,
        error: 'Missing request body',
      });
    }
    
    // Obter Client Secret do ambiente
    const clientSecret = process.env.BLING_CLIENT_SECRET;
    if (!clientSecret) {
      console.error('[Webhook] BLING_CLIENT_SECRET not configured');
      return res.status(500).json({
        success: false,
        error: 'Webhook not configured',
      });
    }
    
    // Validar assinatura HMAC-SHA256
    const isValid = webhookService.validateWebhookSignature(
      rawBody,
      signature,
      clientSecret
    );
    
    if (!isValid) {
      console.error('[Webhook] Invalid signature');
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
      });
    }
    
    // Parse webhook
    const webhook: webhookService.BlingWebhook = JSON.parse(rawBody);
    
    console.log(`[Webhook] Valid webhook: ${webhook.event} (${webhook.eventId})`);
    
    // Processar webhook de forma assíncrona (não bloquear resposta)
    // Importante: Responder 200 rapidamente para evitar retentativas
    setImmediate(() => {
      webhookService.processWebhook(webhook, rawBody)
        .then(result => {
          if (result.success) {
            console.log(`[Webhook] ✅ Processed: ${webhook.event}`);
          } else {
            console.error(`[Webhook] ❌ Failed: ${webhook.event} - ${result.message}`);
          }
        })
        .catch(error => {
          console.error('[Webhook] Unexpected error:', error);
        });
    });
    
    // Responder imediatamente com sucesso
    return res.status(200).json({
      success: true,
      message: 'Webhook received',
    });
    
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/webhooks/bling
 * Endpoint de teste para verificar se webhook está configurado
 */
webhookEndpoint.get('/api/webhooks/bling', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Webhook endpoint is ready',
    timestamp: new Date().toISOString(),
  });
});
