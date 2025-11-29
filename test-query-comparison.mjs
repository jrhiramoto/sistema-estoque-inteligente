import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurada');
  process.exit(1);
}

console.log('🔍 Comparando queries SQL vs Drizzle ORM\n');

const connection = await mysql.createConnection(DATABASE_URL);

// Query 1: SQL Puro (mesma que testamos e funcionou)
console.log('1️⃣ Query SQL Pura:');
const [sqlResults] = await connection.execute(`
  SELECT 
    p.id,
    p.code,
    p.name,
    COALESCE(SUM(i.virtualStock), 0) as virtualStock,
    COALESCE(SUM(i.physicalStock), 0) as physicalStock
  FROM products p
  LEFT JOIN inventory i ON p.id = i.productId
  GROUP BY p.id
  ORDER BY p.name
  LIMIT 5
`);

console.log('Resultados SQL Puro:');
sqlResults.forEach((row, idx) => {
  console.log(`  ${idx + 1}. ID: ${row.id} | Nome: ${row.name} | Físico: ${row.physicalStock} | Virtual: ${row.virtualStock}`);
});

// Query 2: Verificar se há produtos COM estoque
console.log('\n2️⃣ Produtos com estoque > 0:');
const [withStock] = await connection.execute(`
  SELECT 
    p.id,
    p.code,
    p.name,
    SUM(i.physicalStock) as total_stock
  FROM products p
  INNER JOIN inventory i ON p.id = i.productId
  WHERE i.physicalStock > 0
  GROUP BY p.id
  HAVING total_stock > 0
  ORDER BY total_stock DESC
  LIMIT 10
`);

if (withStock.length === 0) {
  console.log('  ⚠️  NENHUM produto tem estoque > 0!');
  console.log('  Isso significa que TODOS os saldos estão zerados no banco.');
} else {
  console.log(`  ✅ Encontrados ${withStock.length} produtos com estoque:`);
  withStock.forEach((row, idx) => {
    console.log(`  ${idx + 1}. ${row.name} (${row.code}) - Estoque: ${row.total_stock}`);
  });
}

// Query 3: Amostra da tabela inventory
console.log('\n3️⃣ Amostra de registros da tabela inventory:');
const [inventorySample] = await connection.execute(`
  SELECT 
    i.id,
    i.productId,
    i.depositName,
    i.physicalStock,
    i.virtualStock,
    p.name as productName
  FROM inventory i
  LEFT JOIN products p ON i.productId = p.id
  LIMIT 10
`);

console.log(`Total de registros na amostra: ${inventorySample.length}`);
inventorySample.forEach((row, idx) => {
  console.log(`  ${idx + 1}. Produto: ${row.productName} | Depósito: ${row.depositName}`);
  console.log(`     Físico: ${row.physicalStock} | Virtual: ${row.virtualStock}`);
});

await connection.end();
console.log('\n✅ Análise concluída');
