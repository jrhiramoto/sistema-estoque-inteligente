import { syncProducts, syncSales } from './server/blingService.ts';
import * as db from './server/db.ts';

console.log('🔄 Iniciando correção de sincronização...\n');

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

console.log(`✅ Usuário encontrado: ${user.name} (ID: ${user.id})\n`);

// Etapa 1: Sincronizar produtos
console.log('📦 ETAPA 1: Sincronizando produtos...');
console.log('Isso vai atualizar os blingId de todos os produtos\n');

try {
  const productsResult = await syncProducts(
    user.id,
    false, // modo completo
    (current, total, message) => {
      console.log(`[Produtos] ${message}`);
    }
  );
  
  console.log(`\n✅ Produtos sincronizados: ${productsResult.synced}`);
  console.log(`❌ Erros: ${productsResult.errors}\n`);
} catch (error) {
  console.error('❌ Erro na sincronização de produtos:', error.message);
  process.exit(1);
}

// Etapa 2: Sincronizar vendas
console.log('💰 ETAPA 2: Sincronizando vendas...');
console.log('Isso vai importar as vendas com os blingId corretos\n');

try {
  const salesResult = await syncSales(
    user.id,
    false, // modo completo
    (current, total, message) => {
      console.log(`[Vendas] ${message}`);
    }
  );
  
  console.log(`\n✅ Vendas sincronizadas: ${salesResult.synced}`);
  console.log(`❌ Erros: ${salesResult.errors}\n`);
} catch (error) {
  console.error('❌ Erro na sincronização de vendas:', error.message);
  process.exit(1);
}

console.log('🎉 Sincronização completa finalizada!');
process.exit(0);
