import mysql from 'mysql2/promise';

async function testBlingConnection() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    // Buscar token do banco
    const [rows] = await connection.execute(
      'SELECT accessToken, tokenExpiresAt FROM bling_config ORDER BY updatedAt DESC LIMIT 1'
    );
    
    if (rows.length === 0) {
      console.log('❌ Nenhuma configuração do Bling encontrada');
      return;
    }
    
    const { accessToken, tokenExpiresAt } = rows[0];
    
    if (!accessToken) {
      console.log('❌ Token de acesso não encontrado');
      return;
    }
    
    const expiresAt = new Date(tokenExpiresAt);
    const now = new Date();
    const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);
    
    console.log('📊 Status do Token:');
    console.log(`  - Token existe: ✅`);
    console.log(`  - Expira em: ${hoursUntilExpiry.toFixed(2)} horas`);
    console.log(`  - Data de expiração: ${expiresAt.toLocaleString('pt-BR')}`);
    
    if (hoursUntilExpiry < 0) {
      console.log('  - Status: ❌ EXPIRADO');
      return;
    } else if (hoursUntilExpiry < 1) {
      console.log('  - Status: ⚠️ EXPIRANDO EM BREVE');
    } else {
      console.log('  - Status: ✅ VÁLIDO');
    }
    
    // Testar requisição à API
    console.log('\n🔄 Testando requisição à API do Bling...');
    
    const response = await fetch('https://www.bling.com.br/Api/v3/produtos?limite=1', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      }
    });
    
    console.log(`  - Status HTTP: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('  - Resposta: ✅ API respondeu corretamente');
      console.log(`  - Total de produtos no Bling: ${data.data?.length || 0} (amostra)`);
      console.log('\n✅ CONEXÃO COM BLING FUNCIONANDO PERFEITAMENTE!');
    } else {
      const error = await response.text();
      console.log('  - Resposta: ❌ Erro na API');
      console.log(`  - Detalhes: ${error}`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar conexão:', error.message);
  } finally {
    await connection.end();
  }
}

testBlingConnection();
