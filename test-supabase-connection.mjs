import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "./drizzle/schema.js";

const DATABASE_URL = "postgresql://postgres.vryujlhlsrcdplptzxzi:a7G8vMU0EDCN29Mi@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

async function testConnection() {
  try {
    console.log("🔄 Testando conexão com Supabase Postgres...");
    
    const client = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 1,
    });
    
    const db = drizzle(client);
    
    console.log("✅ Conexão estabelecida!");
    
    // Testar query simples
    console.log("🔄 Testando query SELECT...");
    const result = await db.select().from(users).limit(1);
    console.log("✅ Query executada com sucesso!");
    console.log("📊 Resultado:", result);
    
    await client.end();
    console.log("\n🎉 SUCESSO! Supabase Postgres funcionando perfeitamente!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERRO na conexão:");
    console.error(error);
    process.exit(1);
  }
}

testConnection();
