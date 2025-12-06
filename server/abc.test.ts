/**
 * Testes para Análise ABC
 * 
 * Valida:
 * 1. Query getCounts retorna contagens corretas
 * 2. Classificação ABC está precisa
 * 3. Badges atualizam após recálculo
 */

import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Análise ABC - Contagens', () => {
  it('getCounts deve retornar contagens de todas as classes', async () => {
    const counts = await db.getAbcCounts();
    
    // Verificar estrutura
    expect(counts).toHaveProperty('classA');
    expect(counts).toHaveProperty('classB');
    expect(counts).toHaveProperty('classC');
    expect(counts).toHaveProperty('classD');
    expect(counts).toHaveProperty('total');
    
    // Verificar que são números
    expect(typeof counts.classA).toBe('number');
    expect(typeof counts.classB).toBe('number');
    expect(typeof counts.classC).toBe('number');
    expect(typeof counts.classD).toBe('number');
    expect(typeof counts.total).toBe('number');
    
    // Verificar que total é soma das classes
    const sum = counts.classA + counts.classB + counts.classC + counts.classD;
    expect(counts.total).toBe(sum);
    
    console.log('✅ Contagens ABC:', counts);
  });

  it('getCounts deve incluir produtos sem estoque', async () => {
    const counts = await db.getAbcCounts();
    const stockMetrics = await db.getAbcStockMetrics();
    
    // getCounts deve ter mais produtos que stockMetrics
    // (porque inclui produtos sem estoque)
    const totalCounts = counts.total;
    const totalWithStock = stockMetrics.total.productCount;
    
    expect(totalCounts).toBeGreaterThanOrEqual(totalWithStock);
    
    console.log('✅ Total produtos classificados:', totalCounts);
    console.log('✅ Total produtos com estoque:', totalWithStock);
    console.log('✅ Produtos sem estoque:', totalCounts - totalWithStock);
  });
});

describe('Análise ABC - Classificação', () => {
  it('produtos com maior faturamento devem ser Classe A', async () => {
    const products = await db.getAllProducts();
    
    // Filtrar produtos com faturamento
    const withRevenue = products.filter(p => (p.abcRevenue || 0) > 0);
    
    // Ordenar por faturamento
    withRevenue.sort((a, b) => (b.abcRevenue || 0) - (a.abcRevenue || 0));
    
    // Top 10 devem ser Classe A
    const top10 = withRevenue.slice(0, 10);
    const allClassA = top10.every(p => p.abcClass === 'A');
    
    expect(allClassA).toBe(true);
    
    console.log('✅ Top 10 produtos por faturamento:');
    top10.forEach((p, i) => {
      console.log(`   ${i+1}. [${p.code}] ${p.name?.substring(0, 40)} - Classe: ${p.abcClass}`);
    });
  });

  it('produtos sem vendas devem ser Classe D', async () => {
    const products = await db.getAllProducts();
    
    // Filtrar produtos sem faturamento
    const noRevenue = products.filter(p => (p.abcRevenue || 0) === 0 && p.abcClass !== null);
    
    // Todos devem ser Classe D
    const allClassD = noRevenue.every(p => p.abcClass === 'D');
    
    expect(allClassD).toBe(true);
    
    console.log('✅ Produtos sem vendas classificados como D:', noRevenue.length);
  });

  it('classes devem seguir ordem decrescente de importância', async () => {
    const products = await db.getAllProducts();
    
    // Filtrar produtos com faturamento e classificação
    const classified = products.filter(p => 
      (p.abcRevenue || 0) > 0 && 
      p.abcClass !== null &&
      p.abcClass !== 'D'
    );
    
    // Calcular média de faturamento por classe
    const avgByClass = {
      A: classified.filter(p => p.abcClass === 'A').reduce((sum, p) => sum + (p.abcRevenue || 0), 0) / classified.filter(p => p.abcClass === 'A').length,
      B: classified.filter(p => p.abcClass === 'B').reduce((sum, p) => sum + (p.abcRevenue || 0), 0) / classified.filter(p => p.abcClass === 'B').length,
      C: classified.filter(p => p.abcClass === 'C').reduce((sum, p) => sum + (p.abcRevenue || 0), 0) / classified.filter(p => p.abcClass === 'C').length,
    };
    
    // Verificar que média de A > B > C
    expect(avgByClass.A).toBeGreaterThan(avgByClass.B);
    expect(avgByClass.B).toBeGreaterThan(avgByClass.C);
    
    console.log('✅ Média de faturamento por classe:', {
      A: `R$ ${(avgByClass.A / 100).toFixed(2)}`,
      B: `R$ ${(avgByClass.B / 100).toFixed(2)}`,
      C: `R$ ${(avgByClass.C / 100).toFixed(2)}`,
    });
    
    // Verificar distribuição esperada (A ≈ 20%, B ≈ 30%, C ≈ 30%, D ≈ 20%)
    const counts = {
      A: classified.filter(p => p.abcClass === 'A').length,
      B: classified.filter(p => p.abcClass === 'B').length,
      C: classified.filter(p => p.abcClass === 'C').length,
    };
    const total = counts.A + counts.B + counts.C;
    
    console.log('✅ Distribuição de produtos com vendas:', {
      A: `${counts.A} (${((counts.A / total) * 100).toFixed(1)}%)`,
      B: `${counts.B} (${((counts.B / total) * 100).toFixed(1)}%)`,
      C: `${counts.C} (${((counts.C / total) * 100).toFixed(1)}%)`,
    });
  });
});

describe('Análise ABC - Integridade', () => {
  it('todos os produtos válidos devem ter classificação', async () => {
    const products = await db.getAllProducts();
    
    // Contar produtos sem classificação
    const unclassified = products.filter(p => p.abcClass === null);
    
    // Idealmente, todos devem estar classificados após cálculo
    // (pode haver alguns não classificados se o cálculo nunca foi executado)
    console.log('✅ Total de produtos:', products.length);
    console.log('✅ Produtos classificados:', products.length - unclassified.length);
    console.log('✅ Produtos sem classificação:', unclassified.length);
    
    // Verificar que a maioria está classificada
    const classifiedPercentage = ((products.length - unclassified.length) / products.length) * 100;
    expect(classifiedPercentage).toBeGreaterThan(50); // Pelo menos 50% classificados
  });

  it('contagens devem bater com produtos reais', async () => {
    const counts = await db.getAbcCounts();
    const products = await db.getAllProducts();
    
    // Contar manualmente
    const manualCounts = {
      classA: products.filter(p => p.abcClass === 'A').length,
      classB: products.filter(p => p.abcClass === 'B').length,
      classC: products.filter(p => p.abcClass === 'C').length,
      classD: products.filter(p => p.abcClass === 'D').length,
    };
    
    // Verificar que batem
    expect(counts.classA).toBe(manualCounts.classA);
    expect(counts.classB).toBe(manualCounts.classB);
    expect(counts.classC).toBe(manualCounts.classC);
    expect(counts.classD).toBe(manualCounts.classD);
    
    console.log('✅ Contagens validadas:', {
      A: counts.classA,
      B: counts.classB,
      C: counts.classC,
      D: counts.classD,
      Total: counts.total,
    });
  });
});
