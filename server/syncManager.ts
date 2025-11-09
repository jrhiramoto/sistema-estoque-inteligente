/**
 * Gerenciador de Sincronizações
 * 
 * Controla concorrência, filas e retries de sincronizações
 */

import * as db from "./db";
import * as blingService from "./blingService";

// Lock global de sincronização
let syncLock: {
  isLocked: boolean;
  currentSync: {
    userId: number;
    syncType: string;
    startedAt: Date;
  } | null;
} = {
  isLocked: false,
  currentSync: null,
};

// Fila de sincronizações pendentes
const syncQueue: Array<{
  userId: number;
  syncType: "products" | "inventory" | "sales" | "full";
  triggeredBy: "manual" | "scheduled" | "webhook";
  historyId: number;
}> = [];

/**
 * Verifica se há uma sincronização em andamento
 */
export function isSyncRunning(): boolean {
  return syncLock.isLocked;
}

/**
 * Obtém informações da sincronização atual
 */
export function getCurrentSync() {
  return syncLock.currentSync;
}

/**
 * Obtém o tamanho da fila
 */
export function getQueueSize(): number {
  return syncQueue.length;
}

/**
 * Adquire o lock de sincronização
 */
function acquireLock(userId: number, syncType: string): boolean {
  if (syncLock.isLocked) {
    return false;
  }
  
  syncLock.isLocked = true;
  syncLock.currentSync = {
    userId,
    syncType,
    startedAt: new Date(),
  };
  
  console.log(`[SyncManager] Lock adquirido: ${syncType} para usuário ${userId}`);
  return true;
}

/**
 * Libera o lock de sincronização
 */
function releaseLock() {
  console.log(`[SyncManager] Lock liberado`);
  syncLock.isLocked = false;
  syncLock.currentSync = null;
  
  // Processar próximo item da fila
  processQueue();
}

/**
 * Adiciona sincronização à fila
 */
async function addToQueue(
  userId: number,
  syncType: "products" | "inventory" | "sales" | "full",
  triggeredBy: "manual" | "scheduled" | "webhook"
): Promise<number> {
  // Criar registro de histórico como "queued"
  const historyId = await db.createSyncHistory({
    syncType,
    status: "queued",
    itemsSynced: 0,
    itemsErrors: 0,
    startedAt: new Date(),
    triggeredBy,
  });
  
  syncQueue.push({
    userId,
    syncType,
    triggeredBy,
    historyId,
  });
  
  console.log(`[SyncManager] Sincronização adicionada à fila: ${syncType} (posição ${syncQueue.length})`);
  
  return historyId;
}

/**
 * Processa o próximo item da fila
 */
async function processQueue() {
  if (syncQueue.length === 0 || syncLock.isLocked) {
    return;
  }
  
  const next = syncQueue.shift();
  if (!next) return;
  
  console.log(`[SyncManager] Processando próximo da fila: ${next.syncType}`);
  
  // Atualizar status para "running"
  await db.updateSyncHistory(next.historyId, {
    status: "running",
    startedAt: new Date(),
  });
  
  // Executar sincronização
  await executeSyncInternal(next.userId, next.syncType, next.triggeredBy, next.historyId);
}

/**
 * Executa a sincronização com controle de concorrência
 */
export async function executeSync(
  userId: number,
  syncType: "products" | "inventory" | "sales" | "full",
  triggeredBy: "manual" | "scheduled" | "webhook" = "manual"
): Promise<{ success: boolean; historyId: number; queued: boolean; message: string }> {
  
  // Tentar adquirir lock
  if (!acquireLock(userId, syncType)) {
    // Lock ocupado, adicionar à fila
    const historyId = await addToQueue(userId, syncType, triggeredBy);
    return {
      success: true,
      historyId,
      queued: true,
      message: `Sincronização adicionada à fila (posição ${syncQueue.length}). Será executada automaticamente.`,
    };
  }
  
  // Lock adquirido, criar histórico e executar
  const historyId = await db.createSyncHistory({
    syncType,
    status: "running",
    itemsSynced: 0,
    itemsErrors: 0,
    startedAt: new Date(),
    triggeredBy,
  });
  
  await executeSyncInternal(userId, syncType, triggeredBy, historyId);
  
  return {
    success: true,
    historyId,
    queued: false,
    message: "Sincronização iniciada com sucesso.",
  };
}

/**
 * Executa a sincronização (uso interno)
 */
async function executeSyncInternal(
  userId: number,
  syncType: "products" | "inventory" | "sales" | "full",
  triggeredBy: "manual" | "scheduled" | "webhook",
  historyId: number
) {
  try {
    let result: any;
    
    switch (syncType) {
      case "products":
        result = await blingService.syncProducts(userId);
        break;
      case "inventory":
        result = await blingService.syncInventory(userId);
        break;
      case "sales":
        result = await blingService.syncSales(userId);
        break;
      case "full":
        // Sincronização completa (produtos + estoque + vendas)
        const products = await blingService.syncProducts(userId);
        const inventory = await blingService.syncInventory(userId);
        const sales = await blingService.syncSales(userId);
        
        result = {
          synced: products.synced + inventory.synced + sales.synced,
          errors: products.errors + inventory.errors + sales.errors,
        };
        break;
    }
    
    // Atualizar histórico como completo
    await db.updateSyncHistory(historyId, {
      status: "completed",
      itemsSynced: result.synced || 0,
      itemsErrors: result.errors || 0,
      completedAt: new Date(),
    });
    
    console.log(`[SyncManager] Sincronização completa: ${syncType}`);
    
  } catch (error: any) {
    console.error(`[SyncManager] ❌ Erro na sincronização ${syncType}:`, error.message);
    
    // Se for erro 429 (rate limit), pausar todas as sincronizações por 10 minutos
    if (error.message && error.message.includes('Limite de requisições atingido')) {
      console.warn('[SyncManager] ⚠️ Rate limit detectado! Pausando sincronizações por 10 minutos...');
      
      await db.updateSyncHistory(historyId, {
        status: "retrying",
        errorMessage: error.message,
        retryCount: 0,
        nextRetryAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos
      });
      
      // Agendar retry
      setTimeout(() => {
        console.log('[SyncManager] Retomando sincronizações após pausa de rate limit...');
        addToQueue(userId, syncType, "scheduled");
        processQueue();
      }, 10 * 60 * 1000);
      
      return;
    }
    
    // Verificar se deve fazer retry
    const history = await db.getRecentSyncHistory(1);
    const currentHistory = history[0];
    
    if (currentHistory && currentHistory.retryCount < currentHistory.maxRetries) {
      // Agendar retry
      const nextRetryMinutes = Math.pow(2, currentHistory.retryCount) * 5; // Backoff exponencial: 5, 10, 20 minutos
      const nextRetryAt = new Date(Date.now() + nextRetryMinutes * 60 * 1000);
      
      await db.updateSyncHistory(historyId, {
        status: "retrying",
        errorMessage: error.message || String(error),
        retryCount: currentHistory.retryCount + 1,
        nextRetryAt,
      });
      
      console.log(`[SyncManager] Retry agendado para ${nextRetryAt.toLocaleString()} (tentativa ${currentHistory.retryCount + 1}/${currentHistory.maxRetries})`);
      
      // Agendar retry (em produção, isso seria feito por um job scheduler)
      setTimeout(() => {
        console.log(`[SyncManager] Executando retry de ${syncType}...`);
        addToQueue(userId, syncType, "scheduled");
        processQueue();
      }, nextRetryMinutes * 60 * 1000);
      
    } else {
      // Falha definitiva
      await db.updateSyncHistory(historyId, {
        status: "failed",
        errorMessage: error.message || String(error),
        completedAt: new Date(),
      });
      
      console.log(`[SyncManager] Sincronização falhou definitivamente após ${currentHistory?.retryCount || 0} tentativas`);
    }
  } finally {
    // Sempre liberar o lock
    releaseLock();
  }
}

/**
 * Verifica e processa retries pendentes (chamado periodicamente)
 */
export async function processRetries() {
  const history = await db.getRecentSyncHistory(100);
  const now = new Date();
  
  for (const item of history) {
    if (item.status === "retrying" && item.nextRetryAt && item.nextRetryAt <= now) {
      console.log(`[SyncManager] Processando retry de ${item.syncType}...`);
      
      // Adicionar à fila
      syncQueue.push({
        userId: 1, // TODO: pegar userId do histórico
        syncType: item.syncType as any,
        triggeredBy: "scheduled",
        historyId: item.id,
      });
    }
  }
  
  processQueue();
}
