import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ABC_CLASSES } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function Products() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [abcFilter, setAbcFilter] = useState<"all" | "A" | "B" | "C">("all");

  const { data: products, isLoading } = trpc.products.list.useQuery(
    abcFilter !== "all" ? { abcClass: abcFilter } : undefined,
    { enabled: !!user }
  );

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const getABCBadgeColor = (abcClass: string | null): "default" | "secondary" | "outline" => {
    if (!abcClass) return "secondary";
    const colors: Record<string, "default" | "secondary" | "outline"> = {
      A: "default",
      B: "secondary",
      C: "outline",
    };
    return colors[abcClass] || "secondary";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </Link>
          
          <h1 className="text-3xl font-bold mb-2">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie seus produtos e parâmetros de estoque
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Busque e filtre produtos por nome, código ou classificação ABC</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={abcFilter} onValueChange={(v) => setAbcFilter(v as any)}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filtrar por ABC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Classes</SelectItem>
                  <SelectItem value="A">Classe A</SelectItem>
                  <SelectItem value="B">Classe B</SelectItem>
                  <SelectItem value="C">Classe C</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {filteredProducts?.length || 0} produto(s) encontrado(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : filteredProducts && filteredProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Classe ABC</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Estoque Mín.</TableHead>
                      <TableHead className="text-right">Ponto Pedido</TableHead>
                      <TableHead>Estocar</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-mono text-sm">
                          {product.code || "-"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell>
                          {product.abcClass ? (
                            <Badge variant={getABCBadgeColor(product.abcClass)}>
                              {product.abcClass}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Não classificado</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(product.price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(product.cost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.minStock}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.reorderPoint}
                        </TableCell>
                        <TableCell>
                          {product.shouldStock ? (
                            <Badge variant="default">Sim</Badge>
                          ) : (
                            <Badge variant="outline">Não</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link href={`/products/${product.id}`}>
                            <Button variant="ghost" size="sm">
                              Ver Detalhes
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Nenhum produto encontrado. {searchTerm && "Tente ajustar os filtros."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
