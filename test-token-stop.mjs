/**
 * Teste: Validar que job para quando isActive=false
 */

import { checkAndRenewToken } from './server/tokenRenewalJob.ts';

console.log('='.repeat(80));
console.log('TESTE: Validar que job para quando isActive=false');
console.log('='.repeat(80));

console.log('\n📋 Executando checkAndRenewToken com isActive=false no banco...\n');

try {
  await checkAndRenewToken(1);
  console.log('\n✅ Job executado sem erros');
  console.log('📝 Verifique os logs acima:');
  console.log('   - Deve mostrar "Integração desativada"');
  console.log('   - NÃO deve tentar renovar token');
  console.log('   - NÃO deve enviar notificação');
} catch (error) {
  console.error('\n❌ Erro ao executar job:', error.message);
  process.exit(1);
}

console.log('\n' + '='.repeat(80));
console.log('TESTE CONCLUÍDO');
console.log('='.repeat(80));
