import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const db = drizzle(process.env.DATABASE_URL);

// Query simples para contar pedidos
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await connection.execute('SELECT COUNT(*) as total FROM orders');
const [sample] = await connection.execute('SELECT * FROM orders ORDER BY orderDate DESC LIMIT 5');

console.log('📊 Estatísticas de Pedidos:');
console.log(`Total de pedidos no banco: ${rows[0].total}`);
console.log('\n📋 Últimos 5 pedidos:');
sample.forEach((order, i) => {
  console.log(`${i+1}. Pedido #${order.orderNumber} - ${order.customerName} - R$ ${(order.totalAmount/100).toFixed(2)} - ${order.itemsCount} itens`);
});

await connection.end();
