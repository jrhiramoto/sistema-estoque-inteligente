import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Buscar situações únicas (simulando a query corrigida)
const [result] = await connection.execute(`
  SELECT DISTINCT statusId, status
  FROM orders
  WHERE status != 'Desconhecido'
  ORDER BY statusId
`);

console.log('📊 SITUAÇÕES ÚNICAS (sem "Desconhecido"):\n');
console.log(`Total: ${result.length} situações`);
console.log('\nLista:');
result.forEach(row => {
  console.log(`  ID ${row.statusId}: ${row.status}`);
});

// Verificar se há duplicatas de statusId
const statusIds = result.map(r => r.statusId);
const uniqueIds = [...new Set(statusIds)];
console.log(`\n✅ IDs únicos: ${uniqueIds.length}`);
console.log(`❌ Total de registros: ${result.length}`);

if (uniqueIds.length !== result.length) {
  console.log(`\n⚠️  ATENÇÃO: Há ${result.length - uniqueIds.length} duplicatas!`);
  const duplicates = statusIds.filter((id, index) => statusIds.indexOf(id) !== index);
  console.log(`IDs duplicados: ${[...new Set(duplicates)].join(', ')}`);
} else {
  console.log('\n✅ Nenhuma duplicata encontrada!');
}

await connection.end();
