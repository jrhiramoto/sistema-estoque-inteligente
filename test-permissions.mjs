import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function testBlingAPI() {
  console.log("🔍 Testando permissões da API do Bling...\n");
  
  try {
    // Parse DATABASE_URL
    const dbUrl = new URL(DATABASE_URL);
    const connection = await mysql.createConnection({
      host: dbUrl.hostname,
      port: dbUrl.port || 3306,
      user: dbUrl.username,
      password: dbUrl.password,
      database: dbUrl.pathname.split('/')[1].split('?')[0],
      ssl: { rejectUnauthorized: true }
    });
    
    // Buscar configuração ativa
    const [rows] = await connection.execute(
      'SELECT * FROM bling_config WHERE isActive = 1 LIMIT 1'
    );
    
    if (rows.length === 0) {
      console.log("❌ Nenhuma configuração ativa do Bling encontrada");
      await connection.end();
      return;
    }
    
    const config = rows[0];
    console.log("✅ Configuração do Bling encontrada");
    console.log(`   Token expira em: ${config.tokenExpiresAt}`);
    console.log(`   Última sincronização: ${config.lastSync}\n`);
    
    await connection.end();
    
    // Testar endpoint de produtos
    console.log("📦 Testando endpoint de produtos...");
    const productsResponse = await fetch("https://www.bling.com.br/Api/v3/produtos?pagina=1&limite=1", {
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Accept": "application/json"
      }
    });
    
    console.log(`   Status: ${productsResponse.status}`);
    if (productsResponse.ok) {
      const productsData = await productsResponse.json();
      console.log(`   ✅ ${productsData.data?.length || 0} produtos retornados\n`);
    } else {
      const errorText = await productsResponse.text();
      console.log(`   ❌ Erro: ${errorText.substring(0, 200)}\n`);
    }
    
    // Testar endpoint de pedidos de venda
    console.log("🛒 Testando endpoint de pedidos de venda...");
    const salesResponse = await fetch("https://www.bling.com.br/Api/v3/pedidos/vendas?pagina=1&limite=1", {
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Accept": "application/json"
      }
    });
    
    console.log(`   Status: ${salesResponse.status}`);
    if (salesResponse.ok) {
      const salesData = await salesResponse.json();
      console.log(`   ✅ ${salesData.data?.length || 0} pedidos retornados`);
      console.log(`   Total de pedidos: ${salesData.total || 0}\n`);
    } else {
      const errorText = await salesResponse.text();
      console.log(`   ❌ Erro: ${errorText.substring(0, 200)}\n`);
    }
    
    // Testar endpoint de estoque
    console.log("📊 Testando endpoint de estoque...");
    const stockResponse = await fetch("https://www.bling.com.br/Api/v3/estoques/saldos?pagina=1&limite=1", {
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Accept": "application/json"
      }
    });
    
    console.log(`   Status: ${stockResponse.status}`);
    if (stockResponse.ok) {
      const stockData = await stockResponse.json();
      console.log(`   ✅ ${stockData.data?.length || 0} registros de estoque retornados\n`);
    } else {
      const errorText = await stockResponse.text();
      console.log(`   ❌ Erro: ${errorText.substring(0, 200)}\n`);
    }
    
    console.log("✅ Teste concluído!");
    
  } catch (error) {
    console.error("❌ Erro ao testar permissões:", error.message);
    console.error(error.stack);
  }
}

testBlingAPI();
