import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Sparkles,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function AdvancedAnalytics() {
  const [activeTab, setActiveTab] = useState("overview");
  
  const { data: evolutionStats, isLoading: evolutionLoading } = trpc.abc.getEvolutionStats.useQuery({ months: 6 });
  const { data: classChanges, isLoading: changesLoading } = trpc.abc.getClassChanges.useQuery({ months: 6 });
  const { data: counts } = trpc.abc.getCounts.useQuery();
  
  const analyzeMutation = trpc.abc.analyzeWithAI.useMutation({
    onError: (error) => {
      toast.error("Erro ao gerar análise", {
        description: error.message,
      });
    },
  });

  const handleAnalyze = () => {
    analyzeMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Análises Avançadas
        </CardTitle>
        <CardDescription>
          Insights profundos sobre evolução temporal e recomendações estratégicas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="evolution">Evolução Temporal</TabsTrigger>
            <TabsTrigger value="ai-analysis">Análise com IA</TabsTrigger>
          </TabsList>

          {/* Visão Geral */}
          <TabsContent value="overview" className="space-y-4">
            {evolutionLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : evolutionStats ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Produtos com Histórico</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{evolutionStats.productsWithHistory}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Últimos 6 meses
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Mudanças de Classe</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{evolutionStats.classChanges}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Produtos que mudaram de classe
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Tendências</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1">
                          <ArrowUpCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">{evolutionStats.trending.up}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ArrowDownCircle className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-medium">{evolutionStats.trending.down}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ascensão vs Queda
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Curva ABC (Pareto) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Curva ABC (Princípio de Pareto)</CardTitle>
                    <CardDescription>
                      Distribuição de produtos por classe de importância
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {counts && (
                      <div className="space-y-4">
                        {/* Barra visual */}
                        <div className="h-12 flex rounded-lg overflow-hidden">
                          <div 
                            className="bg-green-500 flex items-center justify-center text-white text-sm font-medium"
                            style={{ width: `${(counts.classA / counts.total) * 100}%` }}
                          >
                            {((counts.classA / counts.total) * 100).toFixed(1)}%
                          </div>
                          <div 
                            className="bg-blue-500 flex items-center justify-center text-white text-sm font-medium"
                            style={{ width: `${(counts.classB / counts.total) * 100}%` }}
                          >
                            {((counts.classB / counts.total) * 100).toFixed(1)}%
                          </div>
                          <div 
                            className="bg-yellow-500 flex items-center justify-center text-white text-sm font-medium"
                            style={{ width: `${(counts.classC / counts.total) * 100}%` }}
                          >
                            {((counts.classC / counts.total) * 100).toFixed(1)}%
                          </div>
                          <div 
                            className="bg-gray-400 flex items-center justify-center text-white text-sm font-medium"
                            style={{ width: `${(counts.classD / counts.total) * 100}%` }}
                          >
                            {((counts.classD / counts.total) * 100).toFixed(1)}%
                          </div>
                        </div>

                        {/* Legenda */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded bg-green-500" />
                            <div>
                              <p className="text-sm font-medium">Classe A</p>
                              <p className="text-xs text-muted-foreground">{counts.classA} produtos</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded bg-blue-500" />
                            <div>
                              <p className="text-sm font-medium">Classe B</p>
                              <p className="text-xs text-muted-foreground">{counts.classB} produtos</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded bg-yellow-500" />
                            <div>
                              <p className="text-sm font-medium">Classe C</p>
                              <p className="text-xs text-muted-foreground">{counts.classC} produtos</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded bg-gray-400" />
                            <div>
                              <p className="text-sm font-medium">Classe D</p>
                              <p className="text-xs text-muted-foreground">{counts.classD} produtos</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-muted/50 p-4 rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            <strong>Princípio 80-20:</strong> Tipicamente, 20% dos produtos (Classe A) geram 80% do faturamento. 
                            Use esta análise para priorizar gestão de estoque e capital de giro.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Movimentação por Classe */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Movimentação por Classe</CardTitle>
                    <CardDescription>
                      Produtos que entraram e saíram de cada classe (últimos 6 meses)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {(['A', 'B', 'C', 'D'] as const).map((classKey) => {
                        const classData = evolutionStats.byClass[classKey];
                        const netChange = classData.gained - classData.lost;
                        
                        return (
                          <div key={classKey} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Classe {classKey}</span>
                              <Badge variant={netChange > 0 ? "default" : netChange < 0 ? "destructive" : "secondary"}>
                                {netChange > 0 ? '+' : ''}{netChange}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <div className="flex items-center gap-1">
                                <ArrowUpCircle className="h-3 w-3 text-green-500" />
                                <span>Ganhou: {classData.gained}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <ArrowDownCircle className="h-3 w-3 text-red-500" />
                                <span>Perdeu: {classData.lost}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </TabsContent>

          {/* Evolução Temporal */}
          <TabsContent value="evolution" className="space-y-4">
            {changesLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : classChanges && classChanges.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Produtos que Mudaram de Classe</CardTitle>
                  <CardDescription>
                    Últimos 6 meses - Ordenados por importância da mudança
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {classChanges.slice(0, 20).map((change, index) => (
                      <div 
                        key={`${change.productId}-${index}`}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {change.productCode} - {change.productName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Faturamento: {change.revenueChangePercent > 0 ? '+' : ''}{change.revenueChangePercent.toFixed(1)}%
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Badge variant="outline">{change.previousClass}</Badge>
                          {change.trend === 'up' ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : change.trend === 'down' ? (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          ) : (
                            <MinusCircle className="h-4 w-4 text-gray-500" />
                          )}
                          <Badge 
                            variant={
                              change.currentClass === 'A' ? 'default' :
                              change.currentClass === 'B' ? 'secondary' :
                              change.currentClass === 'C' ? 'outline' :
                              'destructive'
                            }
                          >
                            {change.currentClass}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {classChanges.length > 20 && (
                    <p className="text-sm text-muted-foreground mt-4 text-center">
                      Mostrando 20 de {classChanges.length} mudanças
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Sem dados de evolução temporal</p>
                    <p className="text-sm">
                      Execute o recálculo da análise ABC pelo menos 2 vezes em momentos diferentes 
                      para visualizar a evolução temporal das classificações.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Análise com IA */}
          <TabsContent value="ai-analysis" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Análise Profissional com IA
                </CardTitle>
                <CardDescription>
                  Avaliação técnica do momento atual com recomendações estratégicas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={handleAnalyze}
                  disabled={analyzeMutation.isPending}
                  className="w-full"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Gerar Análise com IA
                    </>
                  )}
                </Button>

                {analyzeMutation.data?.success && analyzeMutation.data.analysis && (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <Streamdown>{String(analyzeMutation.data.analysis)}</Streamdown>
                  </div>
                )}

                {analyzeMutation.isError && (
                  <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                    <p className="text-sm font-medium">Erro ao gerar análise</p>
                    <p className="text-xs mt-1">{analyzeMutation.error.message}</p>
                  </div>
                )}

                {!analyzeMutation.data && !analyzeMutation.isPending && (
                  <div className="bg-muted/50 p-6 rounded-lg text-center">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      Clique no botão acima para gerar uma análise profissional com IA sobre 
                      sua gestão de estoque ABC, incluindo pontos positivos, negativos e recomendações estratégicas.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
