import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Verificar quantos pedidos têm statusId 10380
const [before] = await connection.execute(`
  SELECT COUNT(*) as count, status
  FROM orders
  WHERE statusId = 10380
  GROUP BY status
`);

console.log('📊 ANTES DA ATUALIZAÇÃO:');
before.forEach(row => {
  console.log(`  Status "${row.status}": ${row.count} pedidos`);
});

// Atualizar para "Faturado"
const [result] = await connection.execute(`
  UPDATE orders
  SET status = 'Faturado'
  WHERE statusId = 10380
`);

console.log(`\n✅ Atualização concluída: ${result.affectedRows} pedidos atualizados`);

// Verificar após atualização
const [after] = await connection.execute(`
  SELECT COUNT(*) as count, status
  FROM orders
  WHERE statusId = 10380
  GROUP BY status
`);

console.log('\n📊 DEPOIS DA ATUALIZAÇÃO:');
after.forEach(row => {
  console.log(`  Status "${row.status}": ${row.count} pedidos`);
});

await connection.end();
