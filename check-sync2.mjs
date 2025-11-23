import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function checkSync() {
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
    
    // Buscar histórico de sincronizações recentes
    const [rows] = await connection.execute(
      'SELECT * FROM sync_history ORDER BY started_at DESC LIMIT 5'
    );
    
    console.log("📊 Últimas 5 sincronizações:");
    rows.forEach((row, i) => {
      console.log(`\n${i+1}. ${row.sync_type} (${row.trigger_type})`);
      console.log(`   Iniciada: ${row.started_at}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Concluída: ${row.completed_at || 'Em andamento'}`);
      console.log(`   Itens: ${row.items_synced} sincronizados, ${row.items_errors} erros`);
    });
    
    await connection.end();
  } catch (error) {
    console.error("❌ Erro:", error.message);
  }
}

checkSync();
