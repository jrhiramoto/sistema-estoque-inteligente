import cron from 'node-cron';
import * as db from './db';
import { executeSync } from './syncManager';

let scheduledTask: cron.ScheduledTask | null = null;

/**
 * Executa a sincronização agendada (para ser chamada por Vercel Cron)
 */
export async function performScheduledSync() {
  console.log('[Scheduled Sync] Executando sincronização automática incremental...');
  
  try {
    // Buscar configuração de sincronização
    const config = await db.getSyncConfig(1); // TODO: usar userId correto
    
    if (!config || !config.autoSyncEnabled) {
      console.log('[Scheduled Sync] Sincronização automática desativada');
      return;
    }

    // Executar sincronização incremental completa (produtos, estoque, vendas)
    await executeSync(
      1, // TODO: usar userId correto
      'full',
      'scheduled'
    );
    
    // Atualizar timestamp da última sincronização automática
    await db.upsertSyncConfig({
      userId: 1, // TODO: usar userId correto
      lastAutoSync: new Date(),
    });
    
    console.log('[Scheduled Sync] ✅ Sincronização automática concluída com sucesso');
  } catch (error: any) {
    console.error('[Scheduled Sync] ❌ Erro na sincronização automática:', error.message);
    throw error;
  }
}

/**
 * Inicia o job agendado de sincronização automática (para ambiente local/Manus)
 */
export async function startScheduledSync() {
  // Verificar se já existe um job rodando
  if (scheduledTask) {
    console.log('[Scheduled Sync] Job já está rodando');
    return;
  }

  // Buscar configuração de sincronização
  const config = await db.getSyncConfig(1); // TODO: usar userId correto
  
  if (!config || !config.autoSyncEnabled) {
    console.log('[Scheduled Sync] Sincronização automática desativada');
    return;
  }

  const frequencyHours = config.syncFrequencyHours || 24;
  
  // Converter frequência em horas para expressão cron
  let cronExpression: string;
  
  if (frequencyHours >= 168) {
    // Semanal (168h = 7 dias) - Domingo às 3h da manhã
    cronExpression = '0 0 3 * * 0';
  } else if (frequencyHours >= 24) {
    // Diário ou mais - Executar a cada N dias às 3h da manhã
    const days = Math.floor(frequencyHours / 24);
    cronExpression = `0 0 3 */${days} * *`;
  } else {
    // Menos de 24h - Executar a cada X horas (no minuto 0)
    cronExpression = `0 */${frequencyHours} * * *`;
  }
  
  console.log(`[Scheduled Sync] Iniciando job agendado - frequência: a cada ${frequencyHours}h (cron: ${cronExpression})`);

  scheduledTask = cron.schedule(cronExpression, async () => {
    await performScheduledSync();
  });

  console.log('[Scheduled Sync] ✅ Job agendado iniciado com sucesso');
}

/**
 * Para o job agendado de sincronização automática
 */
export function stopScheduledSync() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[Scheduled Sync] Job agendado parado');
  }
}

/**
 * Reinicia o job agendado (útil quando a configuração muda)
 */
export async function restartScheduledSync() {
  console.log('[Scheduled Sync] Reiniciando job agendado...');
  stopScheduledSync();
  await startScheduledSync();
}

/**
 * Retorna o status do job agendado
 */
export function getScheduledSyncStatus() {
  return {
    isRunning: scheduledTask !== null,
  };
}
