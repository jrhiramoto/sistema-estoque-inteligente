import { drizzle } from 'drizzle-orm/mysql2';
import { syncHistory } from './drizzle/schema.ts';
import { desc } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

console.log(`\n📊 Últimas 20 sincronizações:\n`);

const syncs = await db.select()
  .from(syncHistory)
  .orderBy(desc(syncHistory.startedAt))
  .limit(20);

if (syncs.length === 0) {
  console.log('❌ Nenhuma sincronização encontrada no histórico.\n');
} else {
  console.log(`Total: ${syncs.length} sincronização(ões)\n`);
  
  // Agrupar por data
  const byDate = {};
  for (const sync of syncs) {
    const date = sync.startedAt.toISOString().split('T')[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(sync);
  }
  
  for (const [date, dateSyncs] of Object.entries(byDate)) {
    console.log(`\n📅 ${date} (${dateSyncs.length} sincronização(ões))`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    for (const sync of dateSyncs) {
      const time = sync.startedAt.toLocaleTimeString('pt-BR');
      const status = sync.status === 'completed' ? '✅' : sync.status === 'failed' ? '❌' : '⏳';
      const mode = sync.isAutomatic ? '🤖 Auto' : '👤 Manual';
      console.log(`${status} ${time} | ${sync.syncType.padEnd(10)} | ${mode} | ${sync.itemsSynced || 0} itens`);
      if (sync.errorMessage) {
        console.log(`   ⚠️  ${sync.errorMessage}`);
      }
    }
  }
}

console.log('\n');
process.exit(0);
