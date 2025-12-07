/**
 * Gerenciador de Sincronizações
 * 
 * Controla concorrência de sincronizações
 */

import * as db from "./db";
import * as blingService from "./blingService";
import { syncAllProductSuppliers } from "./syncProductSuppliers";

// Lock global de sincronização
let syncLock: {
  isLocked: boolean;
  currentSync: {
    userId: number;
    syncType: string;
    startedAt: Date;
    progress?: {
      current: number;
      total: number;
      message: string;
    };
  } | null;
} = {
  isLocked: false,
  currentSync: null,
};

// Fila removida - sincronização inicia imediatamente ou retorna erro se já estiver rodando

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
  return {
    isRunning: syncLock.isLocked,
    currentSync: syncLock.currentSync,
  };
}

/**
 * Atualiza o progresso da sincronização atual
 */
export async function updateProgress(current: number, total: number | null, message: string, historyId?: number) {
  if (syncLock.currentSync) {
    syncLock.currentSync.progress = { current, total: total || 0, message };
  }
  
  // Atualizar banco de dados a cada 100 itens ou quando total for conhecido
  if (historyId && (current % 100 === 0 || (total && current === total))) {
    try {
      await db.updateSyncHistory(historyId, {
        itemsSynced: current,
      });
    } catch (error) {
      console.error(`[SyncManager] Erro ao atualizar progresso no banco:`, error);
    }
  }
}

// getQueueSize removido - não há mais fila

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
    progress: {
      current: 0,
      total: 0,
      message: "Iniciando sincronização...",
    },
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
  
  // Lock liberado - próxima sincronização pode iniciar
}

// Funções de fila removidas - sincronização inicia imediatamente

/**
 * Executa a sincronização com controle de concorrência
 */
export async function executeSync(
  userId: number,
  syncType: "products" | "inventory" | "sales" | "suppliers" | "full",
  triggeredBy: "manual" | "scheduled" | "webhook" = "manual"
): Promise<{ success: boolean; historyId: number; queued: boolean; message: string }> {
  
  // Tentar adquirir lock
  if (!acquireLock(userId, syncType)) {
    // Lock ocupado, retornar erro
    throw new Error("Já existe uma sincronização em andamento. Aguarde a conclusão antes de iniciar outra.");
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
  
  // Executar sincronização em background (não aguardar conclusão)
  // O lock será liberado quando a sincronização terminar
  executeSyncInternal(userId, syncType, triggeredBy, historyId)
    .catch(error => {
      console.error(`[SyncManager] Erro não tratado em executeSyncInternal:`, error);
      releaseLock();
    });
  
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
  syncType: "products" | "inventory" | "sales" | "suppliers" | "full",
  triggeredBy: "manual" | "scheduled" | "webhook",
  historyId: number
) {
  console.log(`[SyncManager] 🚀 Iniciando executeSyncInternal: syncType=${syncType}, userId=${userId}, historyId=${historyId}`);
  
  try {
    let result: any;
    console.log(`[SyncManager] Entrando no switch para syncType=${syncType}...`);
    
    switch (syncType) {
      case "products":
        result = await blingService.syncProducts(userId, false, (current, total, message) => {
          updateProgress(current, total, message, historyId);
        });
        break;
      case "inventory":
        result = await blingService.syncInventory(userId, (current, total, message) => {
          updateProgress(current, total, message, historyId);
        });
        break;
      case "sales":
        console.log(`[SyncManager] Chamando blingService.syncSales(userId=${userId}, incremental=false)...`);
        result = await blingService.syncSales(userId, false, (current, total, message) => {
          updateProgress(current, total, message, historyId);
        });
        console.log(`[SyncManager] syncSales retornou:`, result);
        break;
      case "suppliers":
        result = await syncAllProductSuppliers(
          userId,
          blingService.blingRequest,
          (current, total) => {
            updateProgress(current, total, `Fornecedores: ${current}/${total} produtos processados`, historyId);
          }
        );
        break;
      case "full":
        // Sincronização completa (produtos + estoque + vendas + fornecedores)
        const products = await blingService.syncProducts(userId, false, (current, total, message) => {
          updateProgress(current, total, `Produtos: ${message}`, historyId);
        });
        const inventory = await blingService.syncInventory(userId, (current, total, message) => {
          updateProgress(current, total, `Estoque: ${message}`, historyId);
        });
        const sales = await blingService.syncSales(userId, false, (current, total, message) => {
          updateProgress(current, total, `Vendas: ${message}`, historyId);
        });
        
        // Sincronizar fornecedores de produtos
        console.log('[Sync] Iniciando sincronização de fornecedores...');
        const suppliers = await syncAllProductSuppliers(
          userId,
          blingService.blingRequest,
          (current, total) => {
            updateProgress(current, total, `Fornecedores: ${current}/${total} produtos processados`, historyId);
          }
        );
        console.log(`[Sync] Fornecedores sincronizados: ${suppliers.totalSuppliers} de ${suppliers.totalProducts} produtos`);
        
        result = {
          synced: products.synced + inventory.synced + sales.synced + suppliers.totalSuppliers,
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
      
      // Retry de rate limit removido - usuário deve tentar manualmente após 10 minutos
      console.log('[SyncManager] Rate limit atingido. Aguarde 10 minutos antes de tentar novamente.');
      
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
      
      // Retry automático removido - usuário deve tentar manualmente
      console.log(`[SyncManager] Sincronização falhou. Retry agendado para ${nextRetryAt.toLocaleString()}, mas deve ser executado manualmente.`);
      
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
      console.log(`[SyncManager] Retry pendente de ${item.syncType}, mas deve ser executado manualmente.`);
      // Retry automático removido
    }
  }
  
  // processQueue removido - não há mais fila
}
