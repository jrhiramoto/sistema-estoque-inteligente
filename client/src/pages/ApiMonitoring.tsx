import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Activity, AlertTriangle, CheckCircle2, Clock, TrendingUp, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ApiMonitoring() {
  const { user, loading: authLoading } = useAuth();
  
  const { data: usageToday, isLoading: loadingToday } = trpc.apiMonitoring.getUsageToday.useQuery(
    undefined,
    { enabled: !!user, refetchInterval: 30000 } // Atualizar a cada 30s
  );
  
  const { data: stats, isLoading: loadingStats } = trpc.apiMonitoring.getUsageStats.useQuery(
    { days: 7 },
    { enabled: !!user, refetchInterval: 60000 } // Atualizar a cada 1min
  );
  
  const { data: recentErrors, isLoading: loadingErrors } = trpc.apiMonitoring.getRecentErrors.useQuery(
    { limit: 10 },
    { enabled: !!user }
  );

  if (authLoading || loadingToday || loadingStats) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando métricas...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const todayCount = usageToday?.length || 0;
  const dailyLimit = 120000;
  const usagePercentage = (todayCount / dailyLimit) * 100;
  const rateLimitErrorsToday = usageToday?.filter(log => log.isRateLimitError).length || 0;
  
  // Calcular taxa atual (requisições por segundo)
  const last10Requests = usageToday?.slice(0, 10) || [];
  let currentRate = 0;
  if (last10Requests.length >= 2) {
    const firstTime = new Date(last10Requests[last10Requests.length - 1].timestamp).getTime();
    const lastTime = new Date(last10Requests[0].timestamp).getTime();
    const timeDiffSeconds = (lastTime - firstTime) / 1000;
    if (timeDiffSeconds > 0) {
      currentRate = last10Requests.length / timeDiffSeconds;
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Monitoramento de API</h1>
          <p className="text-muted-foreground mt-2">
            Acompanhe o uso da API do Bling em tempo real
          </p>
        </div>

        {/* Alertas */}
        {usagePercentage > 80 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção: Limite Próximo</AlertTitle>
            <AlertDescription>
              Você já usou {usagePercentage.toFixed(1)}% do limite diário de requisições ({todayCount.toLocaleString()} / {dailyLimit.toLocaleString()}).
              Considere pausar sincronizações automáticas até amanhã.
            </AlertDescription>
          </Alert>
        )}

        {rateLimitErrorsToday > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erros de Rate Limit Detectados</AlertTitle>
            <AlertDescription>
              {rateLimitErrorsToday} erro(s) 429 detectado(s) hoje. O sistema está usando backoff exponencial e circuit breaker para proteção.
            </AlertDescription>
          </Alert>
        )}

        {/* Cards de Métricas Principais */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Requisições Hoje</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayCount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {usagePercentage.toFixed(1)}% do limite diário
              </p>
              <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    usagePercentage > 80 ? 'bg-destructive' : 
                    usagePercentage > 60 ? 'bg-orange-500' : 
                    'bg-primary'
                  }`}
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa Atual</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentRate.toFixed(2)} req/s</div>
              <p className="text-xs text-muted-foreground">
                Limite: 3 req/s
              </p>
              <div className="mt-2">
                {currentRate < 2.5 ? (
                  <Badge variant="default" className="bg-green-500">Ótimo</Badge>
                ) : currentRate < 2.9 ? (
                  <Badge variant="default" className="bg-orange-500">Moderado</Badge>
                ) : (
                  <Badge variant="destructive">Crítico</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média (7 dias)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.dailyAverage.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                req/dia
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tempo Resposta</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.avgResponseTime || 0}ms
              </div>
              <p className="text-xs text-muted-foreground">
                Média dos últimos 7 dias
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Estatísticas Detalhadas */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Uso nos Últimos 7 Dias</CardTitle>
              <CardDescription>Requisições por dia</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.byDay && Object.keys(stats.byDay).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(stats.byDay)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([date, count]) => {
                      const percentage = (count / dailyLimit) * 100;
                      return (
                        <div key={date} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {new Date(date).toLocaleDateString('pt-BR', { 
                                day: '2-digit', 
                                month: 'short' 
                              })}
                            </span>
                            <span className="font-medium">{count.toLocaleString()} req</span>
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum dado disponível
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Erros de Rate Limit Recentes</CardTitle>
              <CardDescription>Últimos 10 erros 429</CardDescription>
            </CardHeader>
            <CardContent>
              {recentErrors && recentErrors.length > 0 ? (
                <div className="space-y-3">
                  {recentErrors.map((error) => (
                    <div key={error.id} className="flex items-start gap-3 text-sm border-l-2 border-destructive pl-3 py-1">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{error.endpoint}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(error.timestamp).toLocaleString('pt-BR')}
                          {error.retryAttempt > 0 && ` • Tentativa ${error.retryAttempt + 1}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum erro de rate limit registrado
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Informações sobre Limites */}
        <Card>
          <CardHeader>
            <CardTitle>Limites da API do Bling</CardTitle>
            <CardDescription>Informações sobre os limites oficiais</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Requisições por Segundo</p>
                <p className="text-2xl font-bold">3 req/s</p>
                <p className="text-xs text-muted-foreground">Nossa taxa: ~2.8 req/s (margem 7%)</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Requisições por Dia</p>
                <p className="text-2xl font-bold">120.000</p>
                <p className="text-xs text-muted-foreground">~148 sincronizações completas possíveis</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Circuit Breaker</p>
                <p className="text-2xl font-bold">5 erros</p>
                <p className="text-xs text-muted-foreground">Pausa de 1 minuto após threshold</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
