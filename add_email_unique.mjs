import postgres from 'postgres';

const supabaseUrl = "postgresql://postgres.vryujlhlsrcdplptzxzi:a7G8vMU0EDCN29Mi@aws-1-sa-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(supabaseUrl, { ssl: 'require' });

console.log('🔄 Adicionando constraint UNIQUE no email...\n');

try {
  // Verificar se já existe
  const existing = await sql`
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'users' AND constraint_name = 'users_email_unique'
  `;
  
  if (existing.length > 0) {
    console.log('✅ Constraint users_email_unique já existe!');
  } else {
    await sql`ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email")`;
    console.log('✅ Constraint users_email_unique adicionada com sucesso!');
  }
  
  console.log('\n🎉 Migração completa!');
  
} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}
