import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Contar total de pedidos
const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM orders');
const total = countResult[0].total;

// Buscar primeiro pedido (menor número)
const [firstOrder] = await connection.execute(
  'SELECT orderNumber, orderDate, customerName, status, totalAmount FROM orders ORDER BY orderNumber ASC LIMIT 1'
);

// Buscar último pedido (maior número)
const [lastOrder] = await connection.execute(
  'SELECT orderNumber, orderDate, customerName, status, totalAmount FROM orders ORDER BY orderNumber DESC LIMIT 1'
);

// Buscar pedidos por mês para ver distribuição
const [monthlyDist] = await connection.execute(`
  SELECT 
    DATE_FORMAT(orderDate, '%Y-%m') as mes,
    COUNT(*) as quantidade
  FROM orders
  GROUP BY DATE_FORMAT(orderDate, '%Y-%m')
  ORDER BY mes DESC
  LIMIT 12
`);

console.log('📊 RESULTADO DA SINCRONIZAÇÃO DE VENDAS\n');
console.log(`✅ Total de pedidos sincronizados: ${total}`);
console.log('');

if (firstOrder.length > 0) {
  const first = firstOrder[0];
  console.log('📅 PRIMEIRO PEDIDO:');
  console.log(`   Número: ${first.orderNumber}`);
  console.log(`   Data: ${first.orderDate.toISOString().split('T')[0]}`);
  console.log(`   Cliente: ${first.customerName || 'N/A'}`);
  console.log(`   Situação: ${first.status}`);
  console.log(`   Valor: R$ ${(first.totalAmount / 100).toFixed(2)}`);
  console.log('');
}

if (lastOrder.length > 0) {
  const last = lastOrder[0];
  console.log('📅 ÚLTIMO PEDIDO:');
  console.log(`   Número: ${last.orderNumber}`);
  console.log(`   Data: ${last.orderDate.toISOString().split('T')[0]}`);
  console.log(`   Cliente: ${last.customerName || 'N/A'}`);
  console.log(`   Situação: ${last.status}`);
  console.log(`   Valor: R$ ${(last.totalAmount / 100).toFixed(2)}`);
  console.log('');
}

console.log('📈 DISTRIBUIÇÃO POR MÊS (últimos 12 meses):');
monthlyDist.forEach(row => {
  console.log(`   ${row.mes}: ${row.quantidade} pedidos`);
});

await connection.end();
