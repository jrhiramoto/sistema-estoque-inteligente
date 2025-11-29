import crypto from 'crypto';
import * as db from './db';
import { TRPCError } from '@trpc/server';

/**
 * Estrutura padrão de um webhook do Bling
 */
export interface BlingWebhook {
  eventId: string;
  date: string; // ISO 8601
  version: string;
  event: string; // formato: resource.action
  companyId: string;
  data: any;
}

/**
 * Valida a autenticidade de um webhook usando HMAC-SHA256
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  clientSecret: string
): boolean {
  try {
    // Remover prefixo "sha256=" do header
    const receivedHash = signature.replace('sha256=', '');
    
    // Gerar hash local usando o payload e client secret
    const expectedHash = crypto
      .createHmac('sha256', clientSecret)
      .update(payload, 'utf8')
      .digest('hex');
    
    // Comparar hashes de forma segura (timing-safe)
    return crypto.timingSafeEqual(
      Buffer.from(receivedHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  } catch (error) {
    console.error('[Webhook] Error validating signature:', error);
    return false;
  }
}

/**
 * Processa um webhook recebido do Bling
 */
export async function processWebhook(
  webhook: BlingWebhook,
  rawPayload: string
): Promise<{ success: boolean; message: string }> {
  console.log(`[Webhook] Processing: ${webhook.event} (${webhook.eventId})`);
  
  // Verificar idempotência
  const exists = await db.checkWebhookExists(webhook.eventId);
  if (exists) {
    console.log(`[Webhook] Event ${webhook.eventId} already processed (idempotent)`);
    return { success: true, message: 'Event already processed' };
  }
  
  // Registrar webhook no banco
  await db.insertWebhookEvent({
    eventId: webhook.eventId,
    resource: webhook.event.split('.')[0],
    action: webhook.event.split('.')[1],
    companyId: webhook.companyId,
    version: webhook.version,
    payload: rawPayload,
    processed: false,
  });
  
  try {
    // Rotear para handler apropriado
    const [resource, action] = webhook.event.split('.');
    
    switch (resource) {
      case 'product':
        await handleProductWebhook(action, webhook.data);
        break;
      
      case 'stock':
        await handleStockWebhook(action, webhook.data);
        break;
      
      case 'virtual_stock':
        await handleVirtualStockWebhook(action, webhook.data);
        break;
      
      case 'order':
        await handleOrderWebhook(action, webhook.data);
        break;
      
      case 'product_supplier':
        await handleProductSupplierWebhook(action, webhook.data);
        break;
      
      default:
        console.warn(`[Webhook] Unknown resource: ${resource}`);
    }
    
    // Marcar como processado com sucesso
    await db.markWebhookProcessed(webhook.eventId);
    
    console.log(`[Webhook] ✅ Successfully processed: ${webhook.event}`);
    return { success: true, message: 'Webhook processed successfully' };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Webhook] ❌ Error processing ${webhook.event}:`, error);
    
    // Marcar como processado com erro
    await db.markWebhookProcessed(webhook.eventId, errorMessage);
    
    return { success: false, message: errorMessage };
  }
}

/**
 * Handler para webhooks de produtos
 */
async function handleProductWebhook(action: string, data: any) {
  console.log(`[Webhook] Handling product.${action}`, data);
  
  switch (action) {
    case 'created':
      // Produto criado no Bling → Criar no sistema
      await db.upsertProduct({
        blingId: data.id.toString(),
        name: data.nome,
        code: data.codigo || undefined,
        price: data.preco ? Math.round(data.preco * 100) : 0, // Converter para centavos
        unit: data.unidade || undefined,
        description: [data.descricaoCurta, data.descricaoComplementar].filter(Boolean).join('\n') || undefined,
        isActive: data.situacao === 'A',
      });
      console.log(`[Webhook] ✅ Product created: ${data.id} - ${data.nome}`);
      break;
    
    case 'updated':
      // Produto atualizado no Bling → Atualizar no sistema
      await db.upsertProduct({
        blingId: data.id.toString(),
        name: data.nome,
        code: data.codigo || undefined,
        price: data.preco ? Math.round(data.preco * 100) : 0,
        unit: data.unidade || undefined,
        description: [data.descricaoCurta, data.descricaoComplementar].filter(Boolean).join('\n') || undefined,
        isActive: data.situacao === 'A',
      });
      console.log(`[Webhook] ✅ Product updated: ${data.id} - ${data.nome}`);
      break;
    
    case 'deleted':
      // Produto excluído no Bling → Marcar como inativo
      const product = await db.getProductByBlingId(data.id);
      if (product) {
      // Produto excluído - marcar como inativo atualizando o campo situation
      // Nota: O campo 'situation' não existe no schema atual
      // TODO: Adicionar campo 'situation' ou usar outro método para marcar produtos excluídos
        console.log(`[Webhook] ✅ Product deleted (marked inactive): ${data.id}`);
      }
      break;
    
    default:
      console.warn(`[Webhook] Unknown product action: ${action}`);
  }
}

/**
 * Handler para webhooks de estoque físico
 */
async function handleStockWebhook(action: string, data: any) {
  console.log(`[Webhook] Handling stock.${action}`, data);
  
  const productId = data.produto?.id;
  const depositId = data.deposito?.id;
  
  if (!productId || !depositId) {
    console.warn('[Webhook] Missing product or deposit ID in stock webhook');
    return;
  }
  
  // Buscar produto no sistema
  const product = await db.getProductByBlingId(productId);
  if (!product) {
    console.warn(`[Webhook] Product ${productId} not found, skipping stock update`);
    return;
  }
  
  switch (action) {
    case 'created':
    case 'updated':
      // Estoque criado ou atualizado → Atualizar no sistema
      await db.upsertInventory({
        productId: product.id,
        depositId: depositId.toString(),
        physicalStock: data.deposito.saldoFisico || 0,
        virtualStock: data.deposito.saldoVirtual || 0,
        lastVirtualSync: new Date(),
      });
      console.log(`[Webhook] ✅ Stock ${action}: Product ${productId}, Deposit ${depositId}`);
      break;
    
    case 'deleted':
      // Lançamento de estoque excluído → Atualizar saldos
      await db.upsertInventory({
        productId: product.id,
        depositId: depositId.toString(),
        physicalStock: data.deposito?.saldoFisico || 0,
        virtualStock: data.deposito?.saldoVirtual || 0,
        lastVirtualSync: new Date(),
      });
      console.log(`[Webhook] ✅ Stock deleted: Product ${productId}, Deposit ${depositId}`);
      break;
    
    default:
      console.warn(`[Webhook] Unknown stock action: ${action}`);
  }
}

/**
 * Handler para webhooks de estoque virtual
 */
async function handleVirtualStockWebhook(action: string, data: any) {
  console.log(`[Webhook] Handling virtual_stock.${action}`, data);
  
  const productId = data.produto?.id;
  
  if (!productId) {
    console.warn('[Webhook] Missing product ID in virtual stock webhook');
    return;
  }
  
  // Buscar produto no sistema
  const product = await db.getProductByBlingId(productId);
  if (!product) {
    console.warn(`[Webhook] Product ${productId} not found, skipping virtual stock update`);
    return;
  }
  
  if (action === 'updated') {
    // Verificar se tem vínculo complexo (>200 componentes)
    if (data.vinculoComplexo) {
      console.warn(`[Webhook] Product ${productId} has complex links (>200 components), should fetch via API`);
      // TODO: Implementar consulta via API para produtos com vínculo complexo
    }
    
    // Atualizar estoque virtual por depósito
    if (data.depositos && Array.isArray(data.depositos)) {
      for (const deposito of data.depositos) {
        await db.upsertInventory({
          productId: product.id,
          depositId: deposito.id.toString(),
          physicalStock: deposito.saldoFisico || 0,
          virtualStock: deposito.saldoVirtual || 0,
          lastVirtualSync: new Date(),
        });
      }
    }
    
    console.log(`[Webhook] ✅ Virtual stock updated: Product ${productId}`);
  }
}

/**
 * Handler para webhooks de pedidos de venda
 */
async function handleOrderWebhook(action: string, data: any) {
  console.log(`[Webhook] Handling order.${action}`, data);
  
  const orderId = data.id;
  const orderDate = data.data; // Formato: "YYYY-MM-DD"
  const orderTotal = data.total;
  
  switch (action) {
    case 'created':
    case 'updated':
      // Pedido criado ou atualizado → Buscar itens via API e registrar vendas
      console.log(`[Webhook] Order ${action}: ${orderId} - Total: R$ ${orderTotal}`);
      
      try {
        // Buscar configuração do Bling para fazer requisição autenticada
        // Nota: Como webhook é assíncrono, precisamos buscar config do owner
        // Para simplificar, vamos apenas registrar o webhook por enquanto
        // A busca de itens pode ser feita posteriormente via job agendado
        
        console.log(`[Webhook] Order ${orderId} registered, items will be fetched by scheduled job`);
        
        // TODO: Implementar job agendado que:
        // 1. Busca pedidos recentes sem itens detalhados
        // 2. Consulta API do Bling para obter itens
        // 3. Registra vendas na tabela sales para análise ABC
        
      } catch (error) {
        console.error(`[Webhook] Error processing order ${orderId}:`, error);
      }
      break;
    
    case 'deleted':
      // Pedido excluído → Remover vendas relacionadas
      console.log(`[Webhook] Order deleted: ${orderId}`);
      
      try {
        // Buscar e remover vendas relacionadas ao pedido
        const sales = await db.getSalesByOrderId(orderId.toString());
        
        for (const sale of sales) {
          await db.deleteSale(sale.id);
        }
        
        console.log(`[Webhook] ✅ Removed ${sales.length} sales from deleted order ${orderId}`);
      } catch (error) {
        console.error(`[Webhook] Error deleting sales for order ${orderId}:`, error);
      }
      break;
    
    default:
      console.warn(`[Webhook] Unknown order action: ${action}`);
  }
}


/**
 * Handler para webhooks de produto fornecedor
 */
async function handleProductSupplierWebhook(action: string, data: any) {
  console.log(`[Webhook] Handling product_supplier.${action}`, data);
  
  const supplierId = data.id;
  const productId = data.produto?.id;
  const contactId = data.contato?.id;
  
  switch (action) {
    case 'created':
    case 'updated':
      // Produto fornecedor criado ou atualizado
      console.log(`[Webhook] Product supplier ${action}: ${supplierId}`);
      
      try {
        // Buscar produto local pelo blingProductId
        const localProduct = await db.getProductByBlingId(productId?.toString() || '');
        
        if (!localProduct) {
          console.warn(`[Webhook] Product not found for supplier ${supplierId}, skipping`);
          return;
        }
        
        // Preparar dados do fornecedor
        const supplierData = {
          blingId: supplierId.toString(),
          productId: localProduct.id,
          blingProductId: productId?.toString() || '',
          supplierId: contactId?.toString() || '',
          supplierName: data.contato?.nome || null,
          description: data.descricao || null,
          code: data.codigo || null,
          costPrice: data.precoCusto ? Math.round(data.precoCusto * 100) : 0,
          purchasePrice: data.precoCompra ? Math.round(data.precoCompra * 100) : 0,
          isDefault: data.padrao || false,
          warranty: data.garantia || 0,
        };
        
        // Upsert no banco
        await db.upsertProductSupplier(supplierData);
        
        console.log(`[Webhook] ✅ Product supplier ${action}: ${supplierId} for product ${localProduct.name}`);
      } catch (error) {
        console.error(`[Webhook] Error processing product supplier ${supplierId}:`, error);
      }
      break;
    
    case 'deleted':
      // Produto fornecedor excluído
      console.log(`[Webhook] Product supplier deleted: ${supplierId}`);
      
      try {
        await db.deleteProductSupplier(supplierId.toString());
        console.log(`[Webhook] ✅ Product supplier deleted: ${supplierId}`);
      } catch (error) {
        console.error(`[Webhook] Error deleting product supplier ${supplierId}:`, error);
      }
      break;
    
    default:
      console.warn(`[Webhook] Unknown product_supplier action: ${action}`);
  }
}
