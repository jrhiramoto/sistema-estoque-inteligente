import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function Debug() {
  const { data: stats, isLoading } = trpc.debug.stats.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Debug - Estatísticas de Dados</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
            <CardDescription>Total de produtos cadastrados</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats?.products || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registros de Estoque</CardTitle>
            <CardDescription>Total de registros na tabela inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats?.inventory || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produtos com Saldo</CardTitle>
            <CardDescription>Produtos com saldo físico &gt; 0</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats?.productsWithStock || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendas</CardTitle>
            <CardDescription>Total de vendas registradas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats?.sales || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fornecedores</CardTitle>
            <CardDescription>Total de fornecedores de produtos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats?.suppliers || 0}</p>
          </CardContent>
        </Card>
      </div>

      {stats?.sampleInventory && stats.sampleInventory.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Amostra de Estoque</CardTitle>
            <CardDescription>Primeiros 5 registros da tabela inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(stats.sampleInventory, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
