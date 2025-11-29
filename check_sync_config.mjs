import { drizzle } from 'drizzle-orm/mysql2';
import { syncConfig } from './drizzle/schema.ts';

const db = drizzle(process.env.DATABASE_URL);

console.log('\n⚙️  Verificando configuração de sincronização automática...\n');

try {
  const configs = await db.select().from(syncConfig);
  
  if (configs.length === 0) {
    console.log('❌ Nenhuma configuração de sincronização automática encontrada.\n');
  } else {
    for (const config of configs) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`User ID: ${config.userId}`);
      console.log(`Status: ${config.isEnabled ? '✅ ATIVADO' : '❌ DESATIVADO'}`);
      console.log(`Frequência: ${config.frequency}`);
      console.log(`Última execução: ${config.lastRun ? config.lastRun.toLocaleString('pt-BR') : 'Nunca'}`);
      console.log(`Próxima execução: ${config.nextRun ? config.nextRun.toLocaleString('pt-BR') : 'Não agendada'}`);
      console.log('');
    }
  }
  
} catch (error) {
  console.error('❌ Erro ao consultar configuração:', error.message);
}

process.exit(0);
