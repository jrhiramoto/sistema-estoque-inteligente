/**
 * Fórmulas e cálculos para reposição inteligente de estoque
 */

export interface ReplenishmentMetrics {
  avgSales3Months: number;
  avgSales6Months: number;
  avgSales12Months: number;
  stockTurnover: number; // Giro de estoque
  reorderPoint: number; // Ponto de pedido
  suggestedOrderQty: number; // Quantidade sugerida
  daysUntilStockout: number; // Dias até ruptura
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
}

/**
 * Calcula média de vendas para diferentes períodos
 */
export function calculateAvgSales(
  sales: Array<{ quantity: number; saleDate: Date }>,
  months: 3 | 6 | 12
): number {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);
  
  const relevantSales = sales.filter(s => s.saleDate >= cutoffDate);
  const totalQty = relevantSales.reduce((sum, s) => sum + s.quantity, 0);
  
  return totalQty / months;
}

/**
 * Calcula giro de estoque (Stock Turnover)
 * Fórmula: Vendas no período / Estoque médio
 * Quanto maior, melhor (produto gira rápido)
 */
export function calculateStockTurnover(
  totalSales12Months: number,
  currentStock: number
): number {
  if (currentStock === 0) return totalSales12Months > 0 ? 999 : 0;
  return totalSales12Months / currentStock;
}

/**
 * Calcula ponto de pedido (Reorder Point)
 * Fórmula: (Média de vendas diária × Lead time) + Estoque de segurança
 */
export function calculateReorderPoint(
  avgSalesPerMonth: number,
  leadTimeDays: number,
  safetyStock: number = 0
): number {
  const avgSalesPerDay = avgSalesPerMonth / 30;
  return Math.ceil(avgSalesPerDay * leadTimeDays + safetyStock);
}

/**
 * Calcula quantidade sugerida de compra
 * Leva em conta: ABC, giro, lead time, estoque máximo
 */
export function calculateSuggestedOrderQty(
  abcClass: 'A' | 'B' | 'C' | 'D',
  avgSalesPerMonth: number,
  leadTimeDays: number,
  currentStock: number,
  maxStock: number | null,
  stockTurnover: number
): number {
  const avgSalesPerDay = avgSalesPerMonth / 30;
  
  // Fator de cobertura baseado em ABC
  let coverageFactor: number;
  switch (abcClass) {
    case 'A':
      // Classe A: Cobrir lead time + 1 mês extra (segurança)
      coverageFactor = leadTimeDays + 30;
      break;
    case 'B':
      // Classe B: Cobrir lead time + 15 dias
      coverageFactor = leadTimeDays + 15;
      break;
    case 'C':
      // Classe C: Cobrir apenas lead time + 7 dias
      coverageFactor = leadTimeDays + 7;
      break;
    case 'D':
      // Classe D: Não comprar (exceto se produto novo)
      return 0;
  }
  
  // Ajustar por giro de estoque
  // Giro alto (>10) = comprar menos, giro baixo (<3) = comprar mais
  if (stockTurnover > 10) {
    coverageFactor *= 0.8; // Reduzir 20%
  } else if (stockTurnover < 3 && stockTurnover > 0) {
    coverageFactor *= 1.2; // Aumentar 20%
  }
  
  // Calcular quantidade ideal
  const idealStock = Math.ceil(avgSalesPerDay * coverageFactor);
  let suggestedQty = idealStock - currentStock;
  
  // Respeitar estoque máximo (se definido)
  if (maxStock && maxStock > 0) {
    const maxPossible = maxStock - currentStock;
    suggestedQty = Math.min(suggestedQty, maxPossible);
  }
  
  // Não sugerir quantidades negativas
  return Math.max(0, suggestedQty);
}

/**
 * Calcula dias até ruptura de estoque
 */
export function calculateDaysUntilStockout(
  currentStock: number,
  avgSalesPerMonth: number
): number {
  if (avgSalesPerMonth === 0) return 999;
  const avgSalesPerDay = avgSalesPerMonth / 30;
  return Math.floor(currentStock / avgSalesPerDay);
}

/**
 * Determina prioridade de compra
 */
export function calculatePriority(
  abcClass: 'A' | 'B' | 'C' | 'D',
  daysUntilStockout: number,
  leadTimeDays: number
): 'urgent' | 'high' | 'medium' | 'low' | 'none' {
  // Classe D não tem prioridade
  if (abcClass === 'D') return 'none';
  
  // Urgente: Vai acabar antes do lead time
  if (daysUntilStockout < leadTimeDays) return 'urgent';
  
  // Alta: Vai acabar logo após o lead time
  if (daysUntilStockout < leadTimeDays * 1.5) {
    return abcClass === 'A' ? 'urgent' : 'high';
  }
  
  // Média: Ainda tem tempo, mas precisa atenção
  if (daysUntilStockout < leadTimeDays * 2) {
    return abcClass === 'A' ? 'high' : 'medium';
  }
  
  // Baixa: Estoque confortável
  return 'low';
}

/**
 * Calcula todas as métricas de reposição para um produto
 */
export function calculateReplenishmentMetrics(
  sales: Array<{ quantity: number; saleDate: Date }>,
  currentStock: number,
  abcClass: 'A' | 'B' | 'C' | 'D',
  leadTimeDays: number,
  maxStock: number | null,
  safetyStock: number = 0
): ReplenishmentMetrics {
  const avgSales3Months = calculateAvgSales(sales, 3);
  const avgSales6Months = calculateAvgSales(sales, 6);
  const avgSales12Months = calculateAvgSales(sales, 12);
  
  // Usar média de 6 meses como padrão (equilíbrio entre recente e histórico)
  const avgSalesPerMonth = avgSales6Months;
  
  const stockTurnover = calculateStockTurnover(avgSales12Months * 12, currentStock);
  const reorderPoint = calculateReorderPoint(avgSalesPerMonth, leadTimeDays, safetyStock);
  const suggestedOrderQty = calculateSuggestedOrderQty(
    abcClass,
    avgSalesPerMonth,
    leadTimeDays,
    currentStock,
    maxStock,
    stockTurnover
  );
  const daysUntilStockout = calculateDaysUntilStockout(currentStock, avgSalesPerMonth);
  const priority = calculatePriority(abcClass, daysUntilStockout, leadTimeDays);
  
  return {
    avgSales3Months,
    avgSales6Months,
    avgSales12Months,
    stockTurnover,
    reorderPoint,
    suggestedOrderQty,
    daysUntilStockout,
    priority,
  };
}
