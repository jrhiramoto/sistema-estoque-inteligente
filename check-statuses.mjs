import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Buscar situações únicas
const [statuses] = await connection.execute(`
  SELECT 
    status,
    statusId,
    COUNT(*) as quantidade
  FROM orders
  GROUP BY status, statusId
  ORDER BY quantidade DESC
`);

console.log('📋 SITUAÇÕES DOS PEDIDOS:\n');
statuses.forEach(row => {
  console.log(`   ${row.status} (ID: ${row.statusId}) - ${row.quantidade} pedidos`);
});

await connection.end();
