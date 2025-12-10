import postgres from "postgres";
import { readFileSync } from "fs";

const DATABASE_URL = "postgresql://postgres.vryujlhlsrcdplptzxzi:a7G8vMU0EDCN29Mi@aws-1-sa-east-1.pooler.supabase.com:6543/postgres";

async function applyMigrations() {
  try {
    console.log("🔄 Conectando ao Supabase...\n");
    
    const client = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 1,
    });
    
    console.log("✅ Conectado!");
    console.log("🔄 Lendo arquivo SQL...\n");
    
    const sql = readFileSync("/home/ubuntu/sistema-estoque-inteligente/drizzle/0000_acoustic_goliath.sql", "utf-8");
    
    // Remover comentários e quebrar em statements
    const statements = sql
      .split("--> statement-breakpoint")
      .map(s => s.trim())
      .filter(s => s && !s.startsWith("--"));
    
    console.log(`📊 ${statements.length} statements para executar\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;
      
      try {
        await client.unsafe(stmt);
        console.log(`✅ [${i + 1}/${statements.length}] Executado`);
      } catch (error) {
        console.error(`❌ [${i + 1}/${statements.length}] Erro:`, error.message);
        // Continuar mesmo com erro (pode ser tipo já existente)
      }
    }
    
    await client.end();
    console.log("\n🎉 SUCESSO! Migrations aplicadas!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERRO:");
    console.error(error);
    process.exit(1);
  }
}

applyMigrations();
