import { drizzle } from "drizzle-orm/mysql2";
import { products } from "./drizzle/schema.ts";
import { eq, and, or, sql, isNull } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL);

console.log("=== VERIFICAÇÃO DE CONTAGENS ABC ===\n");

// Consultar contagens por classe
const classACounts = await db.select({ count: sql`COUNT(*)` })
  .from(products)
  .where(eq(products.abcClass, 'A'));

const classBCounts = await db.select({ count: sql`COUNT(*)` })
  .from(products)
  .where(eq(products.abcClass, 'B'));

const classCCounts = await db.select({ count: sql`COUNT(*)` })
  .from(products)
  .where(eq(products.abcClass, 'C'));

const classDCounts = await db.select({ count: sql`COUNT(*)` })
  .from(products)
  .where(eq(products.abcClass, 'D'));

const nullClassCounts = await db.select({ count: sql`COUNT(*)` })
  .from(products)
  .where(isNull(products.abcClass));

const totalProducts = await db.select({ count: sql`COUNT(*)` })
  .from(products);

console.log("Contagens no banco de dados:");
console.log(`Classe A: ${classACounts[0].count}`);
console.log(`Classe B: ${classBCounts[0].count}`);
console.log(`Classe C: ${classCCounts[0].count}`);
console.log(`Classe D: ${classDCounts[0].count}`);
console.log(`Sem classe (null): ${nullClassCounts[0].count}`);
console.log(`Total de produtos: ${totalProducts[0].count}`);

// Consultar amostra de cada classe
console.log("\n=== AMOSTRA DE PRODUTOS POR CLASSE ===\n");

const sampleA = await db.select({
  id: products.id,
  name: products.name,
  code: products.code,
  abcClass: products.abcClass,
  abcRevenue: products.abcRevenue,
  abcPercentage: products.abcPercentage,
})
.from(products)
.where(eq(products.abcClass, 'A'))
.orderBy(sql`${products.abcRevenue} DESC`)
.limit(5);

console.log("Top 5 Classe A (maior faturamento):");
sampleA.forEach((p, i) => {
  console.log(`${i+1}. [${p.code}] ${p.name} - Faturamento: R$ ${(p.abcRevenue / 100).toFixed(2)}`);
});

const sampleD = await db.select({
  id: products.id,
  name: products.name,
  code: products.code,
  abcClass: products.abcClass,
  abcRevenue: products.abcRevenue,
})
.from(products)
.where(eq(products.abcClass, 'D'))
.limit(5);

console.log("\nAmostra Classe D (sem vendas):");
sampleD.forEach((p, i) => {
  console.log(`${i+1}. [${p.code}] ${p.name} - Faturamento: R$ ${(p.abcRevenue / 100).toFixed(2)}`);
});

process.exit(0);
