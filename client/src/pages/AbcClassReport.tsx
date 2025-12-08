import { useState } from "react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Home,
  ArrowLeft,
  Package,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Filter,
  BarChart3,
  X,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AbcClass = "A" | "B" | "C" | "D";

const CLASS_CONFIG = {
  A: {
    label: "Classe A",
    color: "bg-green-100 text-green-800 border-green-300",
    description: "Produtos de alta prioridade - maior impacto no faturamento",
  },
  B: {
    label: "Classe B",
    color: "bg-blue-100 text-blue-800 border-blue-300",
    description: "Produtos de média prioridade - impacto moderado",
  },
  C: {
    label: "Classe C",
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
    description: "Produtos de baixa prioridade - menor impacto",
  },
  D: {
    label: "Classe D",
    color: "bg-gray-100 text-gray-800 border-gray-300",
    description: "Produtos sem vendas recentes - considerar descontinuar",
  },
};

export default function AbcClassReport() {
  const params = useParams();
  const abcClass = (params.class?.toUpperCase() || "A") as AbcClass;
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [orderBy, setOrderBy] = useState<string>('physicalStock');
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<{
    lowStock?: boolean;
    noSupplier?: boolean;
    highTurnover?: boolean;
  }>({});
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  
  const config = CLASS_CONFIG[abcClass];
  
  // Query configuração ABC para obter analysisMonths
  const { data: abcConfig } = trpc.abc.getConfig.useQuery();
  const analysisMonths = abcConfig?.analysisMonths || 12;
  
  // Query produtos da classe
  const { data, isLoading } = trpc.abc.getProductsByClass.useQuery({
    abcClass,
    limit: itemsPerPage,
    offset: (page - 1) * itemsPerPage,
    orderBy,
    orderDirection,
    filters,
  }, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  
  // Calcular informações de paginação
  const totalPages = Math.ceil((data?.total || 0) / itemsPerPage);
  const startItem = (page - 1) * itemsPerPage + 1;
  const endItem = Math.min(page * itemsPerPage, data?.total || 0);
  
  // Mutation de exportação
  const exportMutation = trpc.abc.exportToExcel.useMutation({
    onSuccess: (result) => {
      // Converter base64 para blob e fazer download
      const binaryString = atob(result.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
  });
  
  // Função para alternar ordenação
  const handleSort = (column: string) => {
    if (orderBy === column) {
      // Alternar direção se já está ordenando por esta coluna
      setOrderDirection(orderDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nova coluna, começar com desc
      setOrderBy(column);
      setOrderDirection('desc');
    }
  };
  
  // Função para exportar
  const handleExport = () => {
    exportMutation.mutate({
      abcClass,
      orderBy,
      orderDirection,
    });
  };
  
  const toggleExpand = (productId: number) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <Link href="/">
            <Button variant="outline" size="icon">
              <Home className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/analise-abc">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                Relatório {config.label}
              </h1>
              <Badge className={config.color}>
                {data?.total || 0} produtos
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {config.description}
            </p>
          </div>
        </div>
        <Button
          onClick={handleExport}
          disabled={exportMutation.isPending}
          variant="default"
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          {exportMutation.isPending ? 'Exportando...' : 'Exportar Excel'}
        </Button>
      </div>

      {/* Estatísticas Resumidas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Produtos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Estoque Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data?.totalStock || 0).toLocaleString('pt-BR')}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Faturamento Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', { 
                style: 'currency', 
                currency: 'BRL',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(data?.totalRevenue || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros Rápidos */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filtros rápidos:
        </div>
        <Button
          variant={filters.lowStock ? "default" : "outline"}
          size="sm"
          onClick={() => setFilters(prev => ({ ...prev, lowStock: !prev.lowStock }))}
          className="gap-2"
        >
          {filters.lowStock && <X className="h-3 w-3" />}
          Estoque Baixo (&lt; 10)
        </Button>
        <Button
          variant={filters.noSupplier ? "default" : "outline"}
          size="sm"
          onClick={() => setFilters(prev => ({ ...prev, noSupplier: !prev.noSupplier }))}
          className="gap-2"
        >
          {filters.noSupplier && <X className="h-3 w-3" />}
          Sem Fornecedor
        </Button>
        <Button
          variant={filters.highTurnover ? "default" : "outline"}
          size="sm"
          onClick={() => setFilters(prev => ({ ...prev, highTurnover: !prev.highTurnover }))}
          className="gap-2"
        >
          {filters.highTurnover && <X className="h-3 w-3" />}
          Alto Giro (&gt; 5x)
        </Button>
        {(filters.lowStock || filters.noSupplier || filters.highTurnover) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({})}
            className="gap-2 text-muted-foreground"
          >
            <X className="h-3 w-3" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Tabela de Produtos */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos da {config.label}</CardTitle>
          <CardDescription>
            {Object.values(filters).some(v => v) ? (
              <span className="text-primary font-medium">
                Filtros ativos • Mostrando {data?.total || 0} produtos
              </span>
            ) : (
              'Ordenados por quantidade em estoque (maior para menor)'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('code')}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Código
                    {orderBy === 'code' ? (
                      orderDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Descrição
                    {orderBy === 'name' ? (
                      orderDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort('physicalStock')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                  >
                    Estoque Físico
                    {orderBy === 'physicalStock' ? (
                      orderDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    Qtd. Vendida
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Quantidade Total Vendida</p>
                        <p className="text-xs">Total de unidades vendidas no período de análise</p>
                        <p className="text-xs text-muted-foreground mt-1">Métrica usada na classificação ABC (peso 30%)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    Nº Pedidos
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Número de Pedidos</p>
                        <p className="text-xs">Quantidade de pedidos distintos que incluíram este produto</p>
                        <p className="text-xs text-muted-foreground mt-1">Métrica usada na classificação ABC (peso 20%)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    Média Mensal
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Média de Vendas Mensais</p>
                        <p className="text-xs">Fórmula: Total Vendido ÷ Número de Meses</p>
                        <p className="text-xs text-muted-foreground mt-1">Período: Últimos 12 meses (configurável)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    Giro
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Giro de Estoque</p>
                        <p className="text-xs">Fórmula: Vendas no Período ÷ Estoque Físico Atual</p>
                        <p className="text-xs text-muted-foreground mt-1">Indica quantas vezes o estoque "girou" no período</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('supplierName')}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Fornecedor
                    {orderBy === 'supplierName' ? (
                      orderDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort('abcRevenue')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                  >
                    Faturamento
                    {orderBy === 'abcRevenue' ? (
                      orderDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Nenhum produto encontrado nesta classe
                  </TableCell>
                </TableRow>
              ) : (
                data?.products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    isExpanded={expandedProducts.has(product.id)}
                    onToggle={() => toggleExpand(product.id)}
                    analysisMonths={analysisMonths}
                  />
                ))
              )}
            </TableBody>
          </Table>
          </div>
          
          {/* Controles de Paginação */}
          {data && data.total > 0 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {startItem}-{endItem} de {data.total} produtos
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Itens por página:</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setPage(1); // Resetar para primeira página
                    }}
                  >
                    <SelectTrigger className="w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm">
                  Página {page} de {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProductRow({ 
  product, 
  isExpanded, 
  onToggle,
  analysisMonths 
}: { 
  product: any; 
  isExpanded: boolean; 
  onToggle: () => void;
  analysisMonths: number;
}) {
  const { data: salesData } = trpc.abc.getMonthlySales.useQuery(
    { productId: product.id, months: analysisMonths },
    { enabled: isExpanded }
  );
  
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </TableCell>
        <TableCell className="font-mono text-sm">{product.code || "-"}</TableCell>
        <TableCell className="max-w-md">
          <div className="truncate">{product.name}</div>
        </TableCell>
        <TableCell className="text-right font-medium">
          {product.physicalStock?.toLocaleString('pt-BR') || 0}
        </TableCell>
        <TableCell className="text-right font-medium text-orange-600">
          {Number(product.totalQuantitySold || 0).toLocaleString('pt-BR')}
        </TableCell>
        <TableCell className="text-right font-medium text-indigo-600">
          {Number(product.totalOrders || 0).toLocaleString('pt-BR')}
        </TableCell>
        <TableCell className="text-right font-medium text-blue-600">
          {Number(product.averageMonthlySales || 0).toFixed(1)}
        </TableCell>
        <TableCell className="text-right font-medium text-purple-600">
          {Number(product.stockTurnover || 0).toFixed(2)}x
        </TableCell>
        <TableCell>
          <div className="truncate max-w-xs">
            {product.supplierName || "-"}
          </div>
        </TableCell>
        <TableCell className="text-right font-medium">
          {new Intl.NumberFormat('pt-BR', { 
            style: 'currency', 
            currency: 'BRL',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(product.abcRevenue || 0)}
        </TableCell>
      </TableRow>
      
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={10} className="bg-muted/30">
            <div className="py-4 px-2 space-y-6">
              {/* Peso das Métricas ABC */}
              <div>
                <h4 className="font-semibold mb-4 flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5" />
                  Contribuição de Cada Métrica para Classificação ABC
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Faturamento - 50% */}
                  <Card className="p-4 border-green-200 bg-green-50/50">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Faturamento</span>
                        <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">Peso: 50%</span>
                      </div>
                      <div className="text-2xl font-bold text-green-700">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.abcRevenue || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Faturamento total no período de análise
                      </div>
                    </div>
                  </Card>
                  
                  {/* Quantidade Vendida - 30% */}
                  <Card className="p-4 border-orange-200 bg-orange-50/50">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Qtd. Vendida</span>
                        <span className="text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded">Peso: 30%</span>
                      </div>
                      <div className="text-2xl font-bold text-orange-700">
                        {(product.totalQuantitySold || 0).toLocaleString('pt-BR')} un
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Quantidade total vendida no período
                      </div>
                    </div>
                  </Card>
                  
                  {/* Número de Pedidos - 20% */}
                  <Card className="p-4 border-indigo-200 bg-indigo-50/50">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Nº Pedidos</span>
                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">Peso: 20%</span>
                      </div>
                      <div className="text-2xl font-bold text-indigo-700">
                        {(product.totalOrders || 0).toLocaleString('pt-BR')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Pedidos distintos no período
                      </div>
                    </div>
                  </Card>
                </div>
                <div className="mt-3 text-xs text-muted-foreground italic">
                  ℹ️ Estes três fatores são normalizados e ponderados para calcular o score final que determina a posição do produto no ranking ABC.
                </div>
              </div>
              
              {/* Vendas Mensais */}
              <div>
                <h4 className="font-semibold mb-4 flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5" />
                  Vendas Mensais (Últimos {analysisMonths} Meses)
                </h4>
              {salesData && salesData.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {salesData.map((sale: any) => {
                    // Parsear mês diretamente da string para evitar problemas de timezone
                    const [year, month] = sale.month.split('-');
                    const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
                    const monthLabel = `${monthNames[parseInt(month) - 1]}. de ${year}`;
                    
                    return (
                    <Card key={sale.month} className="p-2 min-w-[110px] flex-shrink-0">
                      <div className="text-[11px] text-muted-foreground mb-1 font-medium">
                        {monthLabel}
                      </div>
                      <div className="font-semibold text-sm">{sale.quantity} un</div>
                      <div className="text-[11px] text-muted-foreground font-medium">
                        {new Intl.NumberFormat('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL',
                          minimumFractionDigits: 0,
                        }).format(sale.revenue)}
                      </div>
                    </Card>
                  );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  Sem dados de vendas nos últimos 12 meses
                </div>
              )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
