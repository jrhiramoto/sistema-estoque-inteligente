import postgres from 'postgres';

const supabaseUrl = "postgresql://postgres.vryujlhlsrcdplptzxzi:a7G8vMU0EDCN29Mi@aws-1-sa-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(supabaseUrl, { ssl: 'require' });

console.log('🔍 Verificando estrutura da tabela users...\n');

try {
  const columns = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position
  `;
  
  console.log('Colunas existentes:');
  columns.forEach(col => {
    console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
  });
  
  console.log('\n✅ Verificação concluída!');
  
} catch (error) {
  console.error('❌ Erro:', error.message);
} finally {
  await sql.end();
}
