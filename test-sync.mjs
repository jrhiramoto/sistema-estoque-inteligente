import { syncSales } from './server/blingService.ts';

async function testSync() {
  console.log('\n🧪 Testando sincronização de vendas...\n');
  
  try {
    const userId = 1;
    const mode = 'full';
    
    let lastProgress = '';
    const onProgress = (synced, total, message) => {
      const progress = `[${synced}/${total || '?'}] ${message}`;
      if (progress !== lastProgress) {
        console.log(progress);
        lastProgress = progress;
      }
    };
    
    const result = await syncSales(userId, mode, onProgress);
    
    console.log('\n✅ Sincronização completada!');
    console.log('Resultado:', result);
    
  } catch (error) {
    console.error('\n❌ Erro na sincronização:');
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSync();
