import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Total de pedidos
const [total] = await connection.execute('SELECT COUNT(*) as count FROM orders');

// Pedidos com ID 9 (Atendido)
const [id9] = await connection.execute('SELECT COUNT(*) as count FROM orders WHERE statusId = 9');

// Pedidos com ID 10380 (Faturado)
const [id10380] = await connection.execute('SELECT COUNT(*) as count FROM orders WHERE statusId = 10380');

// Pedidos com IDs relevantes (9 ou 10380)
const [relevant] = await connection.execute('SELECT COUNT(*) as count FROM orders WHERE statusId IN (9, 10380)');

// Outros IDs
const [others] = await connection.execute('SELECT COUNT(*) as count FROM orders WHERE statusId NOT IN (9, 10380)');

console.log('📊 ANÁLISE DE SITUAÇÕES DOS PEDIDOS\n');
console.log(`Total de pedidos: ${total[0].count}`);
console.log(`\n✅ SITUAÇÕES RELEVANTES:`);
console.log(`   ID 9 (Atendido): ${id9[0].count} pedidos`);
console.log(`   ID 10380 (Faturado): ${id10380[0].count} pedidos`);
console.log(`   TOTAL RELEVANTES: ${relevant[0].count} pedidos (${((relevant[0].count / total[0].count) * 100).toFixed(1)}%)`);
console.log(`\n❌ OUTRAS SITUAÇÕES: ${others[0].count} pedidos (${((others[0].count / total[0].count) * 100).toFixed(1)}%)`);

await connection.end();
