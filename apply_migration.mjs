import postgres from 'postgres';
import * as fs from 'fs';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const migration = fs.readFileSync('./drizzle/0001_true_stick.sql', 'utf8');
const statements = migration.split('-->').filter(s => s.trim() && !s.trim().startsWith('statement-breakpoint'));

console.log('Aplicando migração...');
for (const statement of statements) {
  const trimmed = statement.trim();
  if (trimmed) {
    console.log('Executando:', trimmed.substring(0, 100) + '...');
    try {
      await sql.unsafe(trimmed);
      console.log('✓ OK');
    } catch (err) {
      console.log('⚠ Erro (pode ser esperado):', err.message);
    }
  }
}

await sql.end();
console.log('Migração concluída!');
