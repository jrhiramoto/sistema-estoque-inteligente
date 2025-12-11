import postgres from 'postgres';

const supabaseUrl = "postgresql://postgres.vryujlhlsrcdplptzxzi:a7G8vMU0EDCN29Mi@aws-1-sa-east-1.pooler.supabase.com:6543/postgres";

const sql = postgres(supabaseUrl, { ssl: 'require' });

console.log('🔄 Aplicando migração no Supabase...\n');

try {
  // 1. Tornar openId nullable
  console.log('1. Tornando openId nullable...');
  await sql`ALTER TABLE "users" ALTER COLUMN "openId" DROP NOT NULL`;
  console.log('✅ OK\n');

  // 2. Tornar name NOT NULL
  console.log('2. Tornando name NOT NULL...');
  await sql`ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL`;
  console.log('✅ OK\n');

  // 3. Tornar email NOT NULL
  console.log('3. Tornando email NOT NULL...');
  await sql`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`;
  console.log('✅ OK\n');

  // 4. Tornar loginMethod NOT NULL
  console.log('4. Tornando loginMethod NOT NULL...');
  await sql`ALTER TABLE "users" ALTER COLUMN "loginMethod" SET NOT NULL`;
  console.log('✅ OK\n');

  // 5. Adicionar passwordHash
  console.log('5. Adicionando coluna passwordHash...');
  await sql`ALTER TABLE "users" ADD COLUMN "passwordHash" varchar(255)`;
  console.log('✅ OK\n');

  // 6. Adicionar permissions
  console.log('6. Adicionando coluna permissions...');
  await sql`ALTER TABLE "users" ADD COLUMN "permissions" text`;
  console.log('✅ OK\n');

  // 7. Adicionar constraint unique no email
  console.log('7. Adicionando constraint UNIQUE no email...');
  await sql`ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email")`;
  console.log('✅ OK\n');

  console.log('🎉 Migração aplicada com sucesso!');
  
} catch (error) {
  console.error('❌ Erro ao aplicar migração:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}
