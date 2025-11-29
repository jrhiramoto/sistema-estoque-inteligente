import { drizzle } from 'drizzle-orm/mysql2';
import { syncHistory, products, sales } from './drizzle/schema.ts';
import { sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

console.log('\n📊 Verificando dados no banco de dados...\n');

try {
  // Contar sincronizações
  const syncCount = await db.select({ count: sql`count(*)` }).from(syncHistory);
  console.log(`Sincronizações no histórico: ${syncCount[0].count}`);
  
  // Contar produtos
  const productCount = await db.select({ count: sql`count(*)` }).from(products);
  console.log(`Produtos cadastrados: ${productCount[0].count}`);
  
  // Contar vendas
  const salesCount = await db.select({ count: sql`count(*)` }).from(sales);
  console.log(`Vendas registradas: ${salesCount[0].count}`);
  
  // Última sincronização
  const lastSync = await db.select().from(syncHistory).orderBy(sql`startedAt DESC`).limit(1);
  if (lastSync.length > 0) {
    console.log(`\n📅 Última sincronização:`);
    console.log(`   Data: ${lastSync[0].startedAt.toLocaleString('pt-BR')}`);
    console.log(`   Tipo: ${lastSync[0].syncType}`);
    console.log(`   Status: ${lastSync[0].status}`);
    console.log(`   Modo: ${lastSync[0].isAutomatic ? 'Automático' : 'Manual'}`);
  }
  
} catch (error) {
  console.error('❌ Erro ao consultar banco:', error.message);
}

console.log('\n');
process.exit(0);
