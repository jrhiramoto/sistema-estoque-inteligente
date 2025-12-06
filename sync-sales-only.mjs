import { syncSales } from './server/blingService.ts';
import * as db from './server/db.ts';

console.log('💰 Sincronizando APENAS vendas dos últimos 12 meses...\n');

// Buscar owner ID
const ownerOpenId = process.env.OWNER_OPEN_ID;
if (!ownerOpenId) {
  console.error('❌ OWNER_OPEN_ID não encontrado');
  process.exit(1);
}

const user = await db.getUserByOpenId(ownerOpenId);
if (!user) {
  console.error('❌ Usuário owner não encontrado');
  process.exit(1);
}

console.log(`✅ Usuário: ${user.name} (ID: ${user.id})\n`);

try {
  const salesResult = await syncSales(
    user.id,
    false, // modo completo (últimos 12 meses)
    (current, total, message) => {
      console.log(`[Vendas] ${message}`);
    }
  );
  
  console.log(`\n✅ Vendas sincronizadas: ${salesResult.synced}`);
  console.log(`❌ Erros: ${salesResult.errors}\n`);
  console.log('🎉 Sincronização de vendas finalizada!');
} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}

process.exit(0);
