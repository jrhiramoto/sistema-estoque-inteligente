import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import AdvancedAnalytics from "@/components/AdvancedAnalytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  Package, 
  DollarSign, 
  Calendar,
  RefreshCw,
  Search,
  ArrowUpDown,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AbcClass = "A" | "B" | "C" | "D" | null;

export default function AbcAnalysis() {
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState<AbcClass>(null);
  const [sortBy, setSortBy] = useState<"revenue" | "name">("revenue");

  const { data: config, isLoading: configLoading } = trpc.abc.getConfig.useQuery();
  const { data: autoConfig } = trpc.abc.getAutoCalculationConfig.useQuery();
  const { data: distribution } = trpc.abc.getDistribution.useQuery();
  const { data: counts, isLoading: countsLoading, refetch: refetchCounts } = trpc.abc.getCounts.useQuery();
  const { data: stockMetrics, isLoading: stockMetricsLoading, refetch: refetchStockMetrics } = trpc.abc.getStockMetrics.useQuery();
  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = trpc.abc.getProducts.useQuery({
    limit: 1000,
    sortBy: sortBy,
    search: searchTerm || undefined,
    classFilter: classFilter || undefined,
  });
  
  const products = productsData?.products || [];

  const calculateMutation = trpc.abc.calculate.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Análise ABC calculada com sucesso!", {
          description: `${result.stats?.totalProducts} produtos classificados`,
        });
        refetchCounts();
        refetchProducts();
        refetchStockMetrics();
      } else {
        toast.error("Erro ao calcular análise ABC", {
          description: result.message,
        });
      }
    },
    onError: (error) => {
      toast.error("Erro ao calcular análise ABC", {
        description: error.message,
      });
    },
  });

  // Filtrar e ordenar produtos
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    let filtered = products.filter(p => {
      const matchesSearch = !searchTerm || 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesClass = !classFilter || p.abcClass === classFilter;
      
      return matchesSearch && matchesClass;
    });

    // Ordenar
    if (sortBy === "revenue") {
      filtered.sort((a, b) => (b.abcRevenue || 0) - (a.abcRevenue || 0));
    } else {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [products, searchTerm, classFilter, sortBy]);

  // Calcular métricas usando dados de estoque do backend
  const metrics = useMemo(() => {
    if (!stockMetrics) return null;

    const totalStockValue = stockMetrics.total.stockValue;
    const totalStockQuantity = stockMetrics.total.stockQuantity;

    return {
      totalStockValue,
      totalStockQuantity,
      totalProducts: stockMetrics.total.productCount,
      classA: {
        count: stockMetrics.classA.productCount,
        stockValue: stockMetrics.classA.stockValue,
        stockQuantity: stockMetrics.classA.stockQuantity,
        valuePercentage: totalStockValue > 0 ? (stockMetrics.classA.stockValue / totalStockValue) * 100 : 0,
        quantityPercentage: totalStockQuantity > 0 ? (stockMetrics.classA.stockQuantity / totalStockQuantity) * 100 : 0,
      },
      classB: {
        count: stockMetrics.classB.productCount,
        stockValue: stockMetrics.classB.stockValue,
        stockQuantity: stockMetrics.classB.stockQuantity,
        valuePercentage: totalStockValue > 0 ? (stockMetrics.classB.stockValue / totalStockValue) * 100 : 0,
        quantityPercentage: totalStockQuantity > 0 ? (stockMetrics.classB.stockQuantity / totalStockQuantity) * 100 : 0,
      },
      classC: {
        count: stockMetrics.classC.productCount,
        stockValue: stockMetrics.classC.stockValue,
        stockQuantity: stockMetrics.classC.stockQuantity,
        valuePercentage: totalStockValue > 0 ? (stockMetrics.classC.stockValue / totalStockValue) * 100 : 0,
        quantityPercentage: totalStockQuantity > 0 ? (stockMetrics.classC.stockQuantity / totalStockQuantity) * 100 : 0,
      },
      classD: {
        count: stockMetrics.classD.productCount,
        stockValue: stockMetrics.classD.stockValue,
        stockQuantity: stockMetrics.classD.stockQuantity,
        valuePercentage: totalStockValue > 0 ? (stockMetrics.classD.stockValue / totalStockValue) * 100 : 0,
        quantityPercentage: totalStockQuantity > 0 ? (stockMetrics.classD.stockQuantity / totalStockQuantity) * 100 : 0,
      },
    };
  }, [stockMetrics]);

  // Dados para gráfico de Pareto
  const paretoData = useMemo(() => {
    if (!products) return [];

    const sorted = [...products]
      .filter(p => (p.abcRevenue || 0) > 0)
      .sort((a, b) => (b.abcRevenue || 0) - (a.abcRevenue || 0));

    const totalRevenue = sorted.reduce((sum, p) => sum + (p.abcRevenue || 0), 0);
    
    let accumulated = 0;
    return sorted.map(p => {
      accumulated += p.abcRevenue || 0;
      return {
        name: p.name,
        code: p.code,
        revenue: p.abcRevenue || 0,
        percentage: totalRevenue > 0 ? ((p.abcRevenue || 0) / totalRevenue) * 100 : 0,
        accumulated: totalRevenue > 0 ? (accumulated / totalRevenue) * 100 : 0,
        class: p.abcClass,
      };
    });
  }, [products]);

  const getClassColor = (abcClass: string | null) => {
    switch (abcClass) {
      case "A": return "bg-green-500 text-white";
      case "B": return "bg-blue-500 text-white";
      case "C": return "bg-yellow-500 text-white";
      case "D": return "bg-gray-500 text-white";
      default: return "bg-gray-300 text-gray-700";
    }
  };

  const getClassDescription = (abcClass: string) => {
    switch (abcClass) {
      case "A": return "Prioridade máxima - 80% do faturamento";
      case "B": return "Prioridade média - 15% do faturamento";
      case "C": return "Prioridade baixa - 5% do faturamento";
      case "D": return "Sem vendas no período";
      default: return "";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value); // valor já vem em reais do backend
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "Nunca calculado";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(date));
  };

  if (configLoading || productsLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análise ABC+D</h1>
          <p className="text-muted-foreground">
            Classificação de produtos por importância no faturamento
          </p>
        </div>
        <Button
          onClick={() => calculateMutation.mutate()}
          disabled={calculateMutation.isPending}
        >
          {calculateMutation.isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Calculando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Recalcular Análise
            </>
          )}
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900">
                Última atualização: {formatDate(config?.lastCalculation)}
              </p>
              <p className="text-sm text-blue-700">
                Período analisado: {config?.analysisMonths || 12} meses • 
                Recálculo automático: {autoConfig?.enabled ? (
                  autoConfig.frequency === 'daily' ? 'Diário' :
                  autoConfig.frequency === 'weekly' ? 'Semanal' :
                  autoConfig.frequency === 'biweekly' ? 'Quinzenal' :
                  'Mensal'
                ) : "Desativado"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total em Estoque</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics ? formatCurrency(metrics.totalStockValue) : "R$ 0,00"}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.totalProducts || 0} produtos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quantidade Total em Estoque</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.totalStockQuantity.toLocaleString('pt-BR') || "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              Unidades
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {distribution?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Cadastrados no sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Período</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {config?.analysisMonths || 12} meses
            </div>
            <p className="text-xs text-muted-foreground">
              De análise
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por Classe */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Classe A</span>
              {calculateMutation.isPending || countsLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <Badge className="bg-green-500">
                  {counts?.classA || 0} produtos
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Prioridade máxima</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {metrics ? formatCurrency(metrics.classA.stockValue) : "R$ 0,00"}
            </div>
            
            {/* Barra 1: Faturamento */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-green-600 mb-1">
                <span>Valor em Estoque</span>
                <span className="font-semibold">{metrics?.classA.valuePercentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-green-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${metrics?.classA.valuePercentage || 0}%` }}
                />
              </div>
            </div>
            
            {/* Barra 2: Quantidade de Produtos */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-green-600 mb-1">
                <span>Quantidade em Estoque</span>
                <span className="font-semibold">{metrics?.classA.quantityPercentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-green-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-600 transition-all"
                  style={{ width: `${metrics?.classA.quantityPercentage || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Classe B</span>
              {calculateMutation.isPending || countsLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <Badge className="bg-blue-500">
                  {counts?.classB || 0} produtos
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Prioridade média</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {metrics ? formatCurrency(metrics.classB.stockValue) : "R$ 0,00"}
            </div>
            
            {/* Barra 1: Faturamento */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-blue-600 mb-1">
                <span>Valor em Estoque</span>
                <span className="font-semibold">{metrics?.classB.valuePercentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${metrics?.classB.valuePercentage || 0}%` }}
                />
              </div>
            </div>
            
            {/* Barra 2: Quantidade de Produtos */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-blue-600 mb-1">
                <span>Quantidade em Estoque</span>
                <span className="font-semibold">{metrics?.classB.quantityPercentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${metrics?.classB.quantityPercentage || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Classe C</span>
              {calculateMutation.isPending || countsLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <Badge className="bg-yellow-500">
                  {counts?.classC || 0} produtos
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Prioridade baixa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">
              {metrics ? formatCurrency(metrics.classC.stockValue) : "R$ 0,00"}
            </div>
            
            {/* Barra 1: Faturamento */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-yellow-600 mb-1">
                <span>Valor em Estoque</span>
                <span className="font-semibold">{metrics?.classC.valuePercentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-yellow-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 transition-all"
                  style={{ width: `${metrics?.classC.valuePercentage || 0}%` }}
                />
              </div>
            </div>
            
            {/* Barra 2: Quantidade de Produtos */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-yellow-600 mb-1">
                <span>Quantidade em Estoque</span>
                <span className="font-semibold">{metrics?.classC.quantityPercentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-yellow-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-600 transition-all"
                  style={{ width: `${metrics?.classC.quantityPercentage || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 bg-gray-50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Classe D</span>
              {calculateMutation.isPending || countsLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <Badge className="bg-gray-500">
                  {counts?.classD || 0} produtos
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Sem vendas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-700">
              {metrics ? formatCurrency(metrics.classD.stockValue) : "R$ 0,00"}
            </div>
            
            {/* Barra 1: Valor em Estoque */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Valor em Estoque</span>
                <span className="font-semibold">{metrics?.classD.valuePercentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gray-500 transition-all" 
                  style={{ width: `${metrics?.classD.valuePercentage || 0}%` }} 
                />
              </div>
            </div>
            
            {/* Barra 2: Quantidade de Produtos */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Quantidade em Estoque</span>
                <span className="font-semibold">{metrics?.classD.quantityPercentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gray-600 transition-all"
                  style={{ width: `${metrics?.classD.quantityPercentage || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Curva de Pareto */}
      <Card>
        <CardHeader>
          <CardTitle>Curva de Pareto (80-20)</CardTitle>
          <CardDescription>
            Distribuição acumulada do faturamento por produto
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paretoData.length > 0 ? (
            <div className="space-y-4">
              <div className="h-64 flex items-end gap-1">
                {paretoData.slice(0, 50).map((item, index) => {
                  const height = (item.percentage / Math.max(...paretoData.map(d => d.percentage))) * 100;
                  return (
                    <div
                      key={index}
                      className="flex-1 relative group cursor-pointer"
                      title={`${item.name}: ${formatCurrency(item.revenue)} (${item.percentage.toFixed(1)}%)`}
                    >
                      <div
                        className={`w-full rounded-t transition-all ${
                          item.class === "A" ? "bg-green-500 hover:bg-green-600" :
                          item.class === "B" ? "bg-blue-500 hover:bg-blue-600" :
                          "bg-yellow-500 hover:bg-yellow-600"
                        }`}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded" />
                  <span>Classe A (80%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded" />
                  <span>Classe B (15%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded" />
                  <span>Classe C (5%)</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Nenhum dado disponível. Execute a análise ABC primeiro.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Análises Avançadas */}
      <AdvancedAnalytics />

      {/* Tabela de Produtos */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos por Faturamento</CardTitle>
          <CardDescription>
            Lista completa de produtos ordenados por importância
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={classFilter || "all"} onValueChange={(v) => setClassFilter(v === "all" ? null : v as AbcClass)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filtrar classe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="A">Classe A</SelectItem>
                <SelectItem value="B">Classe B</SelectItem>
                <SelectItem value="C">Classe C</SelectItem>
                <SelectItem value="D">Classe D</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as "revenue" | "name")}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Por faturamento</SelectItem>
                <SelectItem value="name">Por nome</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabela */}
          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">#</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Classe</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Código</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Produto</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Faturamento</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">% Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length > 0 ? (
                    filteredProducts.slice(0, 100).map((product: any, index: number) => (
                      <tr key={product.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={getClassColor(product.abcClass)}>
                            {product.abcClass || "—"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">
                          {product.code || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {product.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          {formatCurrency(product.abcRevenue || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                          {product.abcPercentage ? (product.abcPercentage / 100).toFixed(2) : "0.00"}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhum produto encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filteredProducts.length > 100 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Mostrando 100 de {filteredProducts.length} produtos
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
