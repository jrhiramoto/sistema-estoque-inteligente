import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { 
  AlertCircle, 
  BarChart3, 
  Box, 
  ClipboardCheck, 
  Package, 
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  Activity,
  ShoppingCart,
  Users,
  FileText
} from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, loading } = useAuth();
  const { data: overview, isLoading: overviewLoading } = trpc.dashboard.overview.useQuery(
    undefined,
    { 
      enabled: !!user,
      retry: false,
      refetchOnWindowFocus: false
    }
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center">
                <Package className="w-12 h-12 text-primary-foreground" />
              </div>
            </div>
            
            <h1 className="text-5xl font-bold mb-6 text-foreground">
              {APP_TITLE}
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Otimize seu estoque com inteligência de dados. Análise ABC, alertas automáticos, 
              inventário cíclico e integração com Bling ERP.
            </p>
            
            <Button size="lg" asChild className="text-lg px-8 py-6">
              <a href={getLoginUrl()}>
                Entrar no Sistema
                <ArrowRight className="ml-2 w-5 h-5" />
              </a>
            </Button>

            <div className="grid md:grid-cols-3 gap-6 mt-16">
              <Card>
                <CardHeader>
                  <BarChart3 className="w-10 h-10 text-primary mb-2" />
                  <CardTitle>Análise ABC</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Classifique produtos automaticamente e priorize o que realmente importa
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <AlertCircle className="w-10 h-10 text-primary mb-2" />
                  <CardTitle>Alertas Inteligentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Receba notificações de reposição, divergências e estoque crítico
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <ClipboardCheck className="w-10 h-10 text-primary mb-2" />
                  <CardTitle>Inventário Cíclico</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Contagens programadas baseadas na importância de cada produto
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do seu sistema de gestão de estoque
          </p>
        </div>

        {overviewLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Métricas Principais */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Total de Produtos</CardDescription>
                  <CardTitle className="text-3xl">{overview?.totalProducts || 0}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Box className="w-4 h-4 mr-2" />
                    {overview?.activeProducts || 0} ativos
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Alertas Ativos</CardDescription>
                  <CardTitle className="text-3xl text-amber-600">
                    {overview?.totalAlerts || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    {overview?.alertsBySeverity?.critical || 0} críticos
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Produtos Classe A</CardDescription>
                  <CardTitle className="text-3xl text-green-600">
                    {overview?.abcDistribution?.A || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Prioridade máxima
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Produtos Classe B/C</CardDescription>
                  <CardTitle className="text-3xl">
                    {(overview?.abcDistribution?.B || 0) + (overview?.abcDistribution?.C || 0)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    B: {overview?.abcDistribution?.B || 0} | C: {overview?.abcDistribution?.C || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Ações Rápidas */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <Link href="/products">
                <Card className="hover:bg-accent cursor-pointer transition-colors">
                  <CardHeader>
                    <Package className="w-8 h-8 text-primary mb-2" />
                    <CardTitle className="text-lg">Produtos</CardTitle>
                    <CardDescription>Gerenciar produtos e estoque</CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/orders">
                <Card className="hover:bg-accent cursor-pointer transition-colors">
                  <CardHeader>
                    <ShoppingCart className="w-8 h-8 text-blue-600 mb-2" />
                    <CardTitle className="text-lg">Pedidos de Venda</CardTitle>
                    <CardDescription>Gerenciar pedidos e vendas</CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/alerts">
                <Card className="hover:bg-accent cursor-pointer transition-colors">
                  <CardHeader>
                    <AlertCircle className="w-8 h-8 text-amber-600 mb-2" />
                    <CardTitle className="text-lg">Alertas</CardTitle>
                    <CardDescription>Ver alertas e notificações</CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/inventory-count">
                <Card className="hover:bg-accent cursor-pointer transition-colors">
                  <CardHeader>
                    <ClipboardCheck className="w-8 h-8 text-blue-600 mb-2" />
                    <CardTitle className="text-lg">Inventário</CardTitle>
                    <CardDescription>Contagens e conferências</CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/analise-abc">
                <Card className="hover:bg-accent cursor-pointer transition-colors">
                  <CardHeader>
                    <BarChart3 className="w-8 h-8 text-indigo-600 mb-2" />
                    <CardTitle className="text-lg">Análise ABC</CardTitle>
                    <CardDescription>Classificação de produtos</CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/replenishment">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <ShoppingCart className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Reposição</h3>
                  <p className="text-sm text-muted-foreground">Sugestões de compra</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings">
                <Card className="hover:bg-accent cursor-pointer transition-colors">
                  <CardHeader>
                    <BarChart3 className="w-8 h-8 text-purple-600 mb-2" />
                    <CardTitle className="text-lg">Configurações</CardTitle>
                    <CardDescription>Integração e parâmetros</CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/api-monitoring">
                <Card className="hover:bg-accent cursor-pointer transition-colors">
                  <CardHeader>
                    <Activity className="w-8 h-8 text-green-600 mb-2" />
                    <CardTitle className="text-lg">Monitoramento API</CardTitle>
                    <CardDescription>Uso e performance da API</CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              {(user.role === "master" || (user.permissions && user.permissions.includes("manage_users"))) && (
                <>
                  <Link href="/users">
                    <Card className="hover:bg-accent cursor-pointer transition-colors">
                      <CardHeader>
                        <Users className="w-8 h-8 text-indigo-600 mb-2" />
                        <CardTitle className="text-lg">Gerenciar Usuários</CardTitle>
                        <CardDescription>Cadastrar e gerenciar usuários</CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                  <Link href="/audit-logs">
                    <Card className="hover:bg-accent cursor-pointer transition-colors">
                      <CardHeader>
                        <FileText className="w-8 h-8 text-purple-600 mb-2" />
                        <CardTitle className="text-lg">Logs de Auditoria</CardTitle>
                        <CardDescription>Histórico de ações do sistema</CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                </>
              )}

              <Link href="/profile">
                <Card className="hover:bg-accent cursor-pointer transition-colors">
                  <CardHeader>
                    <Users className="w-8 h-8 text-gray-600 mb-2" />
                    <CardTitle className="text-lg">Meu Perfil</CardTitle>
                    <CardDescription>Alterar senha e informações</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
