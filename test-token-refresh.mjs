import mysql from 'mysql2/promise';
import axios from 'axios';

const DATABASE_URL = process.env.DATABASE_URL;
const BLING_OAUTH_URL = "https://www.bling.com.br/Api/v3/oauth/token";

async function testTokenRefresh() {
  console.log("🔄 Testando renovação de token...\n");
  
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
    console.log("✅ Configuração encontrada");
    console.log(`   Token expira em: ${config.tokenExpiresAt}`);
    console.log(`   Refresh token: ${config.refreshToken ? 'Presente' : 'Ausente'}\n`);
    
    if (!config.refreshToken) {
      console.log("❌ Refresh token não encontrado");
      await connection.end();
      return;
    }
    
    // Tentar renovar token
    console.log("🔄 Renovando token...");
    const response = await axios.post(
      BLING_OAUTH_URL,
      {
        grant_type: "refresh_token",
        refresh_token: config.refreshToken,
      },
      {
        auth: {
          username: config.clientId,
          password: config.clientSecret,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    
    const newToken = response.data;
    console.log("✅ Token renovado com sucesso!");
    console.log(`   Novo access_token: ${newToken.access_token.substring(0, 20)}...`);
    console.log(`   Expira em: ${newToken.expires_in} segundos\n`);
    
    // Atualizar no banco
    const newExpiresAt = new Date(Date.now() + newToken.expires_in * 1000);
    await connection.execute(
      'UPDATE bling_config SET accessToken = ?, refreshToken = ?, tokenExpiresAt = ?, updatedAt = NOW() WHERE id = ?',
      [newToken.access_token, newToken.refresh_token, newExpiresAt, config.id]
    );
    
    console.log("✅ Token atualizado no banco de dados");
    console.log(`   Nova data de expiração: ${newExpiresAt}\n`);
    
    // Testar novo token
    console.log("🧪 Testando novo token com API de produtos...");
    const testResponse = await axios.get("https://www.bling.com.br/Api/v3/produtos?pagina=1&limite=1", {
      headers: {
        "Authorization": `Bearer ${newToken.access_token}`,
        "Accept": "application/json"
      }
    });
    
    if (testResponse.status === 200) {
      console.log("✅ Novo token funciona! API respondeu com sucesso");
      console.log(`   Produtos retornados: ${testResponse.data.data?.length || 0}\n`);
    }
    
    await connection.end();
    console.log("✅ Teste concluído com sucesso!");
    
  } catch (error) {
    console.error("❌ Erro:", error.response?.data || error.message);
    console.error(error.stack);
  }
}

testTokenRefresh();
