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
  ChevronRight
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  
  const config = CLASS_CONFIG[abcClass];
  
  // Query produtos da classe
  const { data, isLoading } = trpc.abc.getProductsByClass.useQuery({
    abcClass,
    limit: 100,
    offset: 0,
  });
  
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
        <div className="flex items-center gap-4">
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
              {data?.products.reduce((sum, p) => sum + Number(p.physicalStock || 0), 0).toLocaleString('pt-BR')}
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
              }).format(data?.products.reduce((sum, p) => sum + (p.abcRevenue || 0), 0) || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Produtos */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos da {config.label}</CardTitle>
          <CardDescription>
            Ordenados por quantidade em estoque (maior para menor)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Estoque Físico</TableHead>
                <TableHead className="text-right">Estoque Virtual</TableHead>
                <TableHead className="text-right">Média Mensal</TableHead>
                <TableHead className="text-right">Giro</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
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
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ProductRow({ 
  product, 
  isExpanded, 
  onToggle 
}: { 
  product: any; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const { data: salesData } = trpc.abc.getMonthlySales.useQuery(
    { productId: product.id, months: 12 },
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
        <TableCell className="text-right">
          {Number(product.virtualStock || 0).toLocaleString('pt-BR')}
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
          <TableCell colSpan={9} className="bg-muted/30">
            <div className="py-4 px-2">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Vendas Mensais (Últimos 12 Meses)
              </h4>
              {salesData && salesData.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {salesData.map((sale: any) => (
                    <Card key={sale.month} className="p-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        {new Date(sale.month + '-01').toLocaleDateString('pt-BR', { 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </div>
                      <div className="font-semibold">{sale.quantity} un</div>
                      <div className="text-xs text-muted-foreground">
                        {new Intl.NumberFormat('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL',
                          minimumFractionDigits: 0,
                        }).format(sale.revenue)}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  Sem dados de vendas nos últimos 12 meses
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
