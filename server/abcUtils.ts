/**
 * Funções auxiliares para análise ABC e detecção de outliers
 */

/**
 * Calcula quartis (Q1, Q2/mediana, Q3) de um array de números
 */
export function calculateQuartiles(values: number[]): { q1: number; median: number; q3: number } {
  if (values.length === 0) {
    return { q1: 0, median: 0, q3: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  const lowerHalf = sorted.slice(0, Math.floor(n / 2));
  const upperHalf = sorted.slice(Math.ceil(n / 2));

  const q1 = lowerHalf.length % 2 === 0
    ? (lowerHalf[lowerHalf.length / 2 - 1] + lowerHalf[lowerHalf.length / 2]) / 2
    : lowerHalf[Math.floor(lowerHalf.length / 2)];

  const q3 = upperHalf.length % 2 === 0
    ? (upperHalf[upperHalf.length / 2 - 1] + upperHalf[upperHalf.length / 2]) / 2
    : upperHalf[Math.floor(upperHalf.length / 2)];

  return { q1, median, q3 };
}

/**
 * Detecta outliers usando o método IQR (Interquartile Range)
 * @param values Array de valores numéricos
 * @returns Índices dos outliers detectados
 */
export function detectOutliers(values: number[]): number[] {
  if (values.length < 4) {
    return []; // Não há outliers em amostras muito pequenas
  }

  const { q1, q3 } = calculateQuartiles(values);
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outlierIndices: number[] = [];
  values.forEach((value, index) => {
    if (value < lowerBound || value > upperBound) {
      outlierIndices.push(index);
    }
  });

  return outlierIndices;
}

/**
 * Calcula o faturamento ajustado substituindo outliers pela mediana
 * @param monthlySales Array de vendas mensais (faturamento por mês)
 * @returns Objeto com faturamento ajustado e informações sobre outliers
 */
export function calculateAdjustedRevenue(monthlySales: number[]): {
  adjustedRevenue: number;
  originalRevenue: number;
  outliersDetected: number;
  outlierIndices: number[];
  hasSignificantOutliers: boolean;
} {
  const originalRevenue = monthlySales.reduce((sum, val) => sum + val, 0);

  if (monthlySales.length < 4) {
    return {
      adjustedRevenue: originalRevenue,
      originalRevenue,
      outliersDetected: 0,
      outlierIndices: [],
      hasSignificantOutliers: false,
    };
  }

  const outlierIndices = detectOutliers(monthlySales);

  if (outlierIndices.length === 0) {
    return {
      adjustedRevenue: originalRevenue,
      originalRevenue,
      outliersDetected: 0,
      outlierIndices: [],
      hasSignificantOutliers: false,
    };
  }

  // Calcular mediana dos valores não-outliers
  const nonOutlierValues = monthlySales.filter((_, index) => !outlierIndices.includes(index));
  const { median } = calculateQuartiles(nonOutlierValues);

  // Substituir outliers pela mediana
  const adjustedSales = monthlySales.map((value, index) =>
    outlierIndices.includes(index) ? median : value
  );

  const adjustedRevenue = adjustedSales.reduce((sum, val) => sum + val, 0);

  // Verificar se outliers representam > 50% do faturamento (significativo)
  const outlierRevenue = outlierIndices.reduce((sum, index) => sum + monthlySales[index], 0);
  const hasSignificantOutliers = outlierRevenue > originalRevenue * 0.5;

  return {
    adjustedRevenue,
    originalRevenue,
    outliersDetected: outlierIndices.length,
    outlierIndices,
    hasSignificantOutliers,
  };
}

/**
 * Calcula o coeficiente de variação (CV) de um array de valores
 * CV = (desvio padrão / média) * 100
 */
export function calculateCV(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  if (mean === 0) return 0;

  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return (stdDev / mean) * 100;
}
