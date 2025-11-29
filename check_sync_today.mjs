import { drizzle } from 'drizzle-orm/mysql2';
import { syncHistory } from './drizzle/schema.ts';
import { gte, desc } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

// Data de hoje às 00:00:00
const today = new Date();
today.setHours(0, 0, 0, 0);

console.log(`\n📅 Buscando sincronizações desde: ${today.toISOString()}\n`);

const syncs = await db.select()
  .from(syncHistory)
  .where(gte(syncHistory.startedAt, today))
  .orderBy(desc(syncHistory.startedAt));

if (syncs.length === 0) {
  console.log('❌ Nenhuma sincronização encontrada hoje.\n');
} else {
  console.log(`✅ Encontradas ${syncs.length} sincronização(ões) hoje:\n`);
  
  for (const sync of syncs) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`ID: ${sync.id}`);
    console.log(`Tipo: ${sync.syncType}`);
    console.log(`Status: ${sync.status}`);
    console.log(`Iniciado: ${sync.startedAt.toLocaleString('pt-BR')}`);
    console.log(`Concluído: ${sync.completedAt ? sync.completedAt.toLocaleString('pt-BR') : 'Em andamento'}`);
    console.log(`Itens sincronizados: ${sync.itemsSynced || 0}`);
    console.log(`Modo: ${sync.isAutomatic ? 'Automático' : 'Manual'}`);
    if (sync.errorMessage) {
      console.log(`❌ Erro: ${sync.errorMessage}`);
    }
    console.log('');
  }
}

process.exit(0);
