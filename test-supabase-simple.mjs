import postgres from "postgres";

const DATABASE_URL = "postgresql://postgres.vryujlhlsrcdplptzxzi:a7G8vMU0EDCN29Mi@aws-1-sa-east-1.pooler.supabase.com:6543/postgres";

async function testConnection() {
  try {
    console.log("🔄 Testando conexão com Supabase Postgres...\n");
    
    const client = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 1,
    });
    
    console.log("✅ Cliente Postgres criado!");
    
    // Testar query simples
    console.log("🔄 Testando query SELECT...");
    const result = await client`SELECT version()`;
    console.log("✅ Query executada com sucesso!");
    console.log("📊 Versão do Postgres:", result[0].version);
    
    // Testar se tabelas foram criadas
    console.log("\n🔄 Verificando tabelas criadas...");
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    console.log(`✅ ${tables.length} tabelas encontradas:`);
    tables.forEach(t => console.log(`   - ${t.table_name}`));
    
    await client.end();
    console.log("\n🎉 SUCESSO! Supabase Postgres funcionando perfeitamente!");
    console.log("✅ Schema migrado com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERRO na conexão:");
    console.error(error);
    process.exit(1);
  }
}

testConnection();
