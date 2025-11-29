import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Save, ExternalLink, RefreshCw, CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Settings() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  
  const { data: config, isLoading } = trpc.bling.getConfig.useQuery(
    undefined,
    { enabled: !!user }
  );
  
  // Query para status da sincronização (polling a cada 2 segundos quando está rodando)
  const { data: syncStatus } = trpc.bling.getSyncStatus.useQuery(
    undefined,
    {
      enabled: !!user,
      refetchInterval: (query) => {
        // Se está sincronizando, atualizar a cada 2 segundos
        return query?.state?.data?.isRunning ? 2000 : false;
      },
    }
  );
  
  // Query para configuração de sincronização automática
  const { data: syncConfig } = trpc.bling.getSyncConfig.useQuery(
    undefined,
    { enabled: !!user }
  );
  
  const hasConfig = config !== null && config !== undefined;

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncFrequencyHours, setSyncFrequencyHours] = useState("168");

  useEffect(() => {
    if (hasConfig) {
      setClientId(config?.clientId || "");
      setClientSecret(config?.clientSecret || "");
    }
  }, [config, hasConfig]);
  
  useEffect(() => {
    if (syncConfig) {
      setAutoSyncEnabled(syncConfig.autoSyncEnabled || false);
      setSyncFrequencyHours(String(syncConfig.syncFrequencyHours || 168));
    }
  }, [syncConfig]);

  const saveConfig = trpc.bling.saveConfig.useMutation({
    onSuccess: () => {
      utils.bling.getConfig.invalidate();
      toast.success("Credenciais salvas com sucesso!");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao salvar credenciais");
    },
  });

  const exchangeCode = trpc.bling.exchangeCode.useMutation({
    onSuccess: () => {
      utils.bling.getConfig.invalidate();
      setAuthCode("");
      toast.success("Autorização concluída com sucesso!");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao autorizar");
    },
  });

  const syncAll = trpc.bling.syncAll.useMutation({
    onSuccess: (data) => {
      utils.bling.getConfig.invalidate();
      utils.products.list.invalidate();
      utils.dashboard.overview.invalidate();
      
      if (data.queued) {
        toast.info(data.message);
      } else {
        toast.success(data.message);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao sincronizar");
    },
  });
  
  const saveSyncConfig = trpc.bling.saveSyncConfig.useMutation({
    onSuccess: () => {
      utils.bling.getSyncConfig.invalidate();
      toast.success("Configuração de sincronização salva com sucesso!");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao salvar configuração");
    },
  });

  const handleSaveCredentials = () => {
    if (!clientId || !clientSecret) {
      toast.error("Preencha Client ID e Client Secret");
      return;
    }
    
    saveConfig.mutate({
      clientId,
      clientSecret,
    });
  };

  const handleAuthorize = () => {
    if (!authCode) {
      toast.error("Cole o código de autorização");
      return;
    }

    if (!clientId || !clientSecret) {
      toast.error("Salve as credenciais primeiro");
      return;
    }

    exchangeCode.mutate({
      code: authCode,
      clientId,
      clientSecret,
    });
  };

  const handleSync = () => {
    syncAll.mutate();
  };
  
  const handleSaveSyncConfig = () => {
    saveSyncConfig.mutate({
      autoSyncEnabled,
      syncFrequencyHours: parseInt(syncFrequencyHours),
    });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Nunca";
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </Link>
          
          <h1 className="text-3xl font-bold mb-2">Configurações</h1>
          <p className="text-muted-foreground">
            Configure a integração com o Bling e sincronize seus dados
          </p>
        </div>

        <div className="space-y-6">
          {/* Status da Integração */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Status da Integração</CardTitle>
                  <CardDescription>
                    Verifique o status da conexão com o Bling
                  </CardDescription>
                </div>
                {config?.isActive ? (
                  <Badge variant="default" className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Não conectado
                  </Badge>
                )}
              </div>
            </CardHeader>
            {config?.isActive && (
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Última sincronização:</span>
                    <span className="font-medium">{formatDate(config.lastSync)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Token expira em:</span>
                    <span className="font-medium">{formatDate(config.tokenExpiresAt)}</span>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Passo 1: Credenciais */}
          <Card>
            <CardHeader>
              <CardTitle>1. Credenciais do Aplicativo</CardTitle>
              <CardDescription>
                Configure suas credenciais de API do Bling
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client ID</Label>
                    <Input
                      id="clientId"
                      type="text"
                      placeholder="Seu Client ID do Bling"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientSecret">Client Secret</Label>
                    <Input
                      id="clientSecret"
                      type="password"
                      placeholder="Seu Client Secret do Bling"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSaveCredentials}
                      disabled={saveConfig.isPending}
                    >
                      {saveConfig.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Salvar Credenciais
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Passo 2: Autorização */}
          <Card>
            <CardHeader>
              <CardTitle>2. Autorização OAuth</CardTitle>
              <CardDescription>
                Gere um código de autorização no Bling e cole aqui
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Como obter o código:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Acesse o Portal de Desenvolvedores do Bling</li>
                  <li>Vá em "Meus Aplicativos" e selecione seu app</li>
                  <li>Clique em "Gerar Link de Convite"</li>
                  <li>Abra o link e autorize o aplicativo</li>
                  <li>Copie o código que aparece na URL (parâmetro "code")</li>
                </ol>
                <a
                  href="https://developer.bling.com.br/aplicativos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center text-sm mt-2"
                >
                  Abrir Portal de Desenvolvedores
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>

              <div className="space-y-2">
                <Label htmlFor="authCode">Código de Autorização</Label>
                <Input
                  id="authCode"
                  type="text"
                  placeholder="Cole o código de autorização aqui"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleAuthorize}
                  disabled={exchangeCode.isPending || !clientId || !clientSecret}
                >
                  {exchangeCode.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Autorizar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Passo 3: Sincronização */}
          {config?.isActive && (
            <Card>
              <CardHeader>
                <CardTitle>3. Sincronização de Dados</CardTitle>
                <CardDescription>
                  Sincronize produtos, estoque e vendas do Bling
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Exibir última sincronização */}
                {config?.lastSync && (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Última Sincronização</p>
                        <p className="text-xs text-muted-foreground">
                          Produtos, vendas e estoque
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatDate(config.lastSync)}</p>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  Clique no botão abaixo para sincronizar todos os dados do Bling. 
                  Isso pode levar alguns minutos dependendo da quantidade de produtos.
                </p>

                {/* Barra de Progresso */}
                {(() => {
                  if (!syncStatus?.isRunning || !(syncStatus as any).currentSync?.progress) return null;
                  
                  const progress = (syncStatus as any).currentSync.progress;
                  const percentage = progress.total > 0 
                    ? (progress.current / progress.total) * 100 
                    : 0;
                  
                  return (
                    <div className="space-y-3 p-5 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-semibold text-blue-900 dark:text-blue-100">
                              {progress.message}
                            </span>
                            <span className="text-blue-700 dark:text-blue-300 font-medium">
                              {progress.current.toLocaleString()}
                              {progress.total > 0 && (
                                <> / {progress.total.toLocaleString()}</>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Progress 
                          value={percentage} 
                          className="h-3"
                        />
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-blue-700 dark:text-blue-300">
                            Sincronização em andamento... Por favor, aguarde.
                          </span>
                          {progress.total > 0 && (
                            <span className="font-semibold text-blue-900 dark:text-blue-100">
                              {Math.round(percentage)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                
                {/* Fila de Sincronização - Removido pois não está implementado */}

                <Separator />

                <div className="flex justify-end">
                  <Button
                    onClick={handleSync}
                    disabled={syncAll.isPending || syncStatus?.isRunning}
                    size="lg"
                  >
                    {(syncAll.isPending || syncStatus?.isRunning) ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    {syncStatus?.isRunning ? "Sincronizando..." : "Sincronizar Agora"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configuração de Sincronização Automática */}
          {hasConfig && config?.isActive && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  4. Sincronização Automática
                </CardTitle>
                <CardDescription>
                  Sincronização periódica como fallback dos webhooks (recomendado: semanal)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Exibir última sincronização */}
                {config?.lastSync && (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Última Sincronização</p>
                        <p className="text-xs text-muted-foreground">
                          {syncConfig?.lastAutoSync ? 'Automática' : 'Manual'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatDate(config.lastSync)}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-sync">Ativar Sincronização Automática</Label>
                      <p className="text-sm text-muted-foreground">
                        Garante consistência dos dados mesmo se webhooks falharem temporariamente
                      </p>
                    </div>
                    <Switch
                      id="auto-sync"
                      checked={autoSyncEnabled}
                      onCheckedChange={setAutoSyncEnabled}
                    />
                  </div>

                  {autoSyncEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="frequency">Frequência de Sincronização</Label>
                      <Select
                        value={syncFrequencyHours}
                        onValueChange={setSyncFrequencyHours}
                      >
                        <SelectTrigger id="frequency">
                          <SelectValue placeholder="Selecione a frequência" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">A cada 1 hora</SelectItem>
                          <SelectItem value="3">A cada 3 horas</SelectItem>
                          <SelectItem value="6">A cada 6 horas</SelectItem>
                          <SelectItem value="12">A cada 12 horas</SelectItem>
                          <SelectItem value="24">A cada 24 horas (1 dia)</SelectItem>
                          <SelectItem value="48">A cada 48 horas (2 dias)</SelectItem>
                          <SelectItem value="168">A cada 168 horas (1 semana)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        A sincronização automática é incremental: busca apenas produtos, vendas e estoque alterados desde a última sincronização, economizando tempo e requisições.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveSyncConfig}
                    disabled={saveSyncConfig.isPending}
                  >
                    {saveSyncConfig.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Salvar Configuração
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Informações */}
          <Card>
            <CardHeader>
              <CardTitle>Sobre o Sistema</CardTitle>
              <CardDescription>
                Informações sobre o Sistema de Gestão de Estoque Inteligente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>Versão:</strong> 1.0.0</p>
                <p><strong>Funcionalidades:</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1 text-muted-foreground">
                  <li>Análise ABC automática</li>
                  <li>Alertas inteligentes de reposição</li>
                  <li>Inventário cíclico programado</li>
                  <li>Integração com Bling ERP via OAuth 2.0</li>
                  <li>Sincronização automática de produtos, estoque e vendas</li>
                  <li>Dashboards e métricas em tempo real</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
