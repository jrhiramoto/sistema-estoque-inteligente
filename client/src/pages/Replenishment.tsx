import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Package, TrendingUp, Clock, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Home } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const priorityConfig = {
  urgent: { label: "Urgente", color: "bg-red-500", icon: AlertTriangle },
  high: { label: "Alta", color: "bg-orange-500", icon: AlertTriangle },
  medium: { label: "Média", color: "bg-yellow-500", icon: Clock },
  low: { label: "Baixa", color: "bg-green-500", icon: CheckCircle2 },
  none: { label: "Sem prioridade", color: "bg-gray-500", icon: Package },
};

const abcClassConfig = {
  A: { label: "A", color: "bg-green-600" },
  B: { label: "B", color: "bg-blue-600" },
  C: { label: "C", color: "bg-yellow-600" },
  D: { label: "D", color: "bg-gray-600" },
};

export default function Replenishment() {
  const [search, setSearch] = useState("");
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());

  const { data: suppliers, isLoading } = trpc.replenishment.getProducts.useQuery({
    search: search || undefined,
  });

  const toggleSupplier = (supplierId: string) => {
    setExpandedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(supplierId)) {
        next.delete(supplierId);
      } else {
        next.add(supplierId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const totalProducts = suppliers?.reduce((sum, s) => sum + s.products.length, 0) || 0;
  const urgentProducts = suppliers?.reduce(
    (sum, s) => sum + s.products.filter((p: any) => p.metrics.priority === "urgent").length,
    0
  ) || 0;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reposição de Estoque</h1>
          <p className="text-muted-foreground">Sugestões inteligentes de compra baseadas em análise ABC e giro de estoque</p>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm">
            <Home className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Urgentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{urgentProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Fornecedores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou nome do produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Suppliers List */}
      <div className="space-y-4">
        {suppliers?.map((supplier) => {
          const isExpanded = expandedSuppliers.has(supplier.supplierId);
          const maxPriority = supplier.products[0]?.metrics.priority || "none";
          const PriorityIcon = priorityConfig[maxPriority as keyof typeof priorityConfig].icon;

          return (
            <Card key={supplier.supplierId} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleSupplier(supplier.supplierId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PriorityIcon className={`h-5 w-5 text-white ${priorityConfig[maxPriority as keyof typeof priorityConfig].color} rounded-full p-1`} />
                    <div>
                      <CardTitle>{supplier.supplierName}</CardTitle>
                      <CardDescription>{supplier.products.length} produtos precisam de reposição</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={priorityConfig[maxPriority as keyof typeof priorityConfig].color}>{priorityConfig[maxPriority as keyof typeof priorityConfig].label}</Badge>
                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {supplier.products.map((product: any) => (
                      <div key={product.productId} className="border rounded-lg p-4 space-y-3">
                        {/* Product Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{product.productName}</h3>
                              <Badge className={abcClassConfig[product.abcClass as keyof typeof abcClassConfig].color}>
                                Classe {product.abcClass}
                              </Badge>
                              <Badge className={priorityConfig[product.metrics.priority].color}>
                                {priorityConfig[product.metrics.priority].label}
                              </Badge>
                              {product.isNew && <Badge variant="outline">Novo</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">Código: {product.productCode}</p>
                          </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Estoque Atual</p>
                            <p className="font-semibold">{product.physicalStock || 0} un</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Quantidade Sugerida</p>
                            <p className="font-semibold text-green-600">{product.metrics.suggestedOrderQty} un</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Giro de Estoque</p>
                            <p className="font-semibold">{product.metrics.stockTurnover.toFixed(1)}x</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Dias até Ruptura</p>
                            <p className="font-semibold">
                              {product.metrics.daysUntilStockout > 999 ? "∞" : `${product.metrics.daysUntilStockout} dias`}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Média Vendas (6m)</p>
                            <p className="font-semibold">{product.metrics.avgSales6Months.toFixed(1)} un/mês</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Lead Time</p>
                            <p className="font-semibold">{product.leadTimeDays || 0} dias</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Ponto de Pedido</p>
                            <p className="font-semibold">{product.metrics.reorderPoint} un</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Estoque Máximo</p>
                            <p className="font-semibold">{product.maxStock || "Não definido"}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="default">
                            Comprar {product.metrics.suggestedOrderQty} un
                          </Button>
                          <Button size="sm" variant="outline">
                            Ajustar Parâmetros
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {suppliers?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-semibold">Nenhum produto precisa de reposição</p>
              <p className="text-muted-foreground">Todos os produtos estão com estoque adequado</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
