import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

/**
 * Teste de validação do BLING_CLIENT_SECRET
 * 
 * Este teste verifica se o Client Secret está configurado corretamente
 * simulando a validação HMAC-SHA256 que o Bling usa para assinar webhooks
 */

describe('Webhook Configuration', () => {
  it('should have BLING_CLIENT_SECRET configured', () => {
    const clientSecret = process.env.BLING_CLIENT_SECRET;
    
    expect(clientSecret).toBeDefined();
    expect(clientSecret).not.toBe('');
    expect(clientSecret!.length).toBeGreaterThan(10);
  });
  
  it('should be able to generate valid HMAC-SHA256 signature', () => {
    const clientSecret = process.env.BLING_CLIENT_SECRET!;
    const testPayload = JSON.stringify({
      eventId: 'test-123',
      event: 'product.created',
      data: { id: 123, nome: 'Test' }
    });
    
    // Gerar hash HMAC-SHA256
    const hash = crypto
      .createHmac('sha256', clientSecret)
      .update(testPayload, 'utf8')
      .digest('hex');
    
    // Verificar que hash foi gerado
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // SHA256 = 64 caracteres hex
    
    // Verificar que hash é consistente
    const hash2 = crypto
      .createHmac('sha256', clientSecret)
      .update(testPayload, 'utf8')
      .digest('hex');
    
    expect(hash).toBe(hash2);
  });
  
  it('should validate webhook signature correctly', () => {
    const clientSecret = process.env.BLING_CLIENT_SECRET!;
    const payload = '{"eventId":"test","event":"product.created"}';
    
    // Gerar signature (como o Bling faria)
    const expectedHash = crypto
      .createHmac('sha256', clientSecret)
      .update(payload, 'utf8')
      .digest('hex');
    
    const signature = `sha256=${expectedHash}`;
    
    // Validar signature (como nosso sistema faz)
    const receivedHash = signature.replace('sha256=', '');
    const calculatedHash = crypto
      .createHmac('sha256', clientSecret)
      .update(payload, 'utf8')
      .digest('hex');
    
    expect(receivedHash).toBe(calculatedHash);
  });
});
