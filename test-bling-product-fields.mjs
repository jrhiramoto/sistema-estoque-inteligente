import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function testBlingProductFields() {
  try {
    const dbUrl = new URL(DATABASE_URL);
    const connection = await mysql.createConnection({
      host: dbUrl.hostname,
      port: dbUrl.port || 3306,
      user: dbUrl.username,
      password: dbUrl.password,
      database: dbUrl.pathname.split('/')[1].split('?')[0],
      ssl: { rejectUnauthorized: true }
    });
    
    // Buscar configuração do Bling
    const [config] = await connection.execute(
      'SELECT * FROM bling_config WHERE userId = 1 LIMIT 1'
    );
    
    if (!config || config.length === 0) {
      console.log("❌ Configuração do Bling não encontrada");
      await connection.end();
      return;
    }
    
    const accessToken = config[0].accessToken;
    
    // Buscar um produto específico da API
    const response = await fetch('https://api.bling.com.br/Api/v3/produtos?pagina=1&limite=3', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`❌ Erro na API: ${response.status} ${response.statusText}`);
      await connection.end();
      return;
    }
    
    const data = await response.json();
    
    console.log("📦 Estrutura dos primeiros 3 produtos da API do Bling:\n");
    
    if (data.data && data.data.length > 0) {
      data.data.forEach((produto, index) => {
        console.log(`\n--- Produto ${index + 1} ---`);
        console.log(`ID: ${produto.id}`);
        console.log(`Código: ${produto.codigo || 'N/A'}`);
        console.log(`Nome: ${produto.nome}`);
        console.log(`Preço (campo 'preco'): ${produto.preco}`);
        console.log(`Custo (campo 'precoCusto'): ${produto.precoCusto || 'N/A'}`);
        console.log(`\nCampos disponíveis:`, Object.keys(produto).join(', '));
      });
    } else {
      console.log("Nenhum produto encontrado");
    }
    
    await connection.end();
  } catch (error) {
    console.error("❌ Erro:", error.message);
  }
}

testBlingProductFields();
