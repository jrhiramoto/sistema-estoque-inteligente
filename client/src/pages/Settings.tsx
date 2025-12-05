import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Save, ExternalLink, RefreshCw, CheckCircle2, AlertCircle, Loader2, Clock, Filter } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OrderStatusFilter } from "@/components/OrderStatusFilter";

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
  const [orderNumber, setOrderNumber] = useState("49170");
  const [authCode, setAuthCode] = useState("");
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncFrequencyHours, setSyncFrequencyHours] = useState("168");
  const [showTestModal, setShowTestModal] = useState(false);
  const [testOrdersData, setTestOrdersData] = useState<any>(null);

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
        toast.success("Sincronização completa iniciada!");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao sincronizar");
    },
  });
  
  const syncProducts = trpc.bling.syncProducts.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      utils.dashboard.overview.invalidate();
      toast.success("Sincronização de produtos iniciada!");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao sincronizar produtos");
    },
  });
  
  const syncInventory = trpc.bling.syncInventory.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("Sincronização de estoque iniciada!");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao sincronizar estoque");
    },
  });
  
  const syncSales = trpc.bling.syncSales.useMutation({
    onSuccess: () => {
      utils.orders.list.invalidate();
      utils.orders.stats.invalidate();
      toast.success("Sincronização de vendas iniciada!");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao sincronizar vendas");
    },
  });
  
  const syncSuppliers = trpc.bling.syncSuppliers.useMutation({
    onSuccess: () => {
      toast.success("Sincronização de fornecedores iniciada!");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao sincronizar fornecedores");
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
  
  const listOrderSituations = trpc.bling.listOrderSituations.useQuery(
    undefined,
    { enabled: false } // Só executa quando chamado manualmente
  );
  
  const testFetchOrders = trpc.bling.testFetchOrders.useMutation({
    onSuccess: (data) => {
      console.log('[Test] Pedidos retornados:', data);
      setTestOrdersData(data);
      setShowTestModal(true);
      toast.success(`Teste concluído! ${data.count} pedidos encontrados.`);
    },
    onError: (error) => {
      toast.error(`Erro ao buscar pedidos: ${error.message}`);
    },
  });
  
  const debugSaveOrder = trpc.bling.debugSaveOrder.useMutation({
    onSuccess: (data) => {
      console.log('[Debug] Resultado:', data);
      if (data.success) {
        toast.success('✅ Pedido salvo com sucesso! Verifique o console (F12) para detalhes.');
      } else {
        toast.error(
          <div className="space-y-2">
            <p className="font-semibold">❌ Erro ao salvar pedido:</p>
            <pre className="text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
              {data.error}
            </pre>
          </div>,
          { duration: 15000 }
        );
      }
    },
    onError: (error) => {
      toast.error(`Erro ao executar debug: ${error.message}`);
    },
  });
  
  const fetchOrderByNumber = trpc.bling.fetchOrderByNumber.useMutation({
    onSuccess: (data) => {
      console.log('[fetchOrderByNumber] Resultado completo:', data);
      if (data.success) {
        console.log('[fetchOrderByNumber] ===== PEDIDO COMPLETO =====');
        console.log(JSON.stringify(data.pedido, null, 2));
        console.log('[fetchOrderByNumber] ===== FIM =====');
        
        toast.success(
          <div className="space-y-2">
            <p className="font-semibold">✅ Pedido encontrado!</p>
            <p className="text-xs">Estrutura completa no console (F12)</p>
            <pre className="text-xs whitespace-pre-wrap max-h-40 overflow-y-auto bg-muted p-2 rounded">
              {JSON.stringify(data.pedido, null, 2)}
            </pre>
          </div>,
          { duration: 20000 }
        );
      } else {
        toast.error(data.error || 'Pedido não encontrado');
      }
    },
    onError: (error) => {
      toast.error(`Erro ao buscar pedido: ${error.message}`);
    },
  });
  
  const handleListSituations = async () => {
    try {
      const result = await listOrderSituations.refetch();
      if (result.data) {
        const situationsText = result.data
          .map(s => `ID: ${s.id} - ${s.nome}`)
          .join('\n');
        
        toast.success(
          <div className="space-y-2">
            <p className="font-semibold">Situações de Pedidos do Bling:</p>
            <pre className="text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
              {situationsText}
            </pre>
          </div>,
          { duration: 10000 }
        );
      }
    } catch (error: any) {
      // Se erro de autorização, invalidar config para atualizar UI
      if (error.message?.includes('expirou') || error.message?.includes('autorize')) {
        utils.bling.getConfig.invalidate();
      }
      toast.error(error.message || "Erro ao listar situações");
    }
  };

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

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleListSituations}
                      disabled={!config?.isActive || listOrderSituations.isFetching}
                      title={!config?.isActive ? "Autorize o aplicativo primeiro (Passo 2)" : ""}
                    >
                      {listOrderSituations.isFetching ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Listar Situações de Pedidos
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testFetchOrders.mutate({})}
                      disabled={!config?.isActive || testFetchOrders.isPending}
                      title={!config?.isActive ? "Autorize o aplicativo primeiro (Passo 2)" : ""}
                    >
                      {testFetchOrders.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Testar Busca de Pedidos (5 últimos)
                    </Button>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => debugSaveOrder.mutate()}
                      disabled={!config?.isActive || debugSaveOrder.isPending}
                      title={!config?.isActive ? "Autorize o aplicativo primeiro (Passo 2)" : ""}
                    >
                      {debugSaveOrder.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      🐛 Debug: Salvar 1 Pedido
                    </Button>
                    
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label htmlFor="orderNumber" className="text-xs">Número do Pedido</Label>
                        <Input
                          id="orderNumber"
                          value={orderNumber}
                          onChange={(e) => setOrderNumber(e.target.value)}
                          placeholder="Ex: 49170"
                          className="h-8"
                        />
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => fetchOrderByNumber.mutate({ orderNumber })}
                        disabled={!config?.isActive || fetchOrderByNumber.isPending || !orderNumber}
                        title={!config?.isActive ? "Autorize o aplicativo primeiro (Passo 2)" : ""}
                      >
                        {fetchOrderByNumber.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        🔍 Buscar Pedido
                      </Button>
                    </div>
                  </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Sincronize apenas o que você precisa para economizar tempo e chamadas à API.
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Button
                      onClick={() => syncProducts.mutate()}
                      disabled={syncProducts.isPending || syncStatus?.isRunning}
                      variant="outline"
                      className="h-auto flex-col gap-2 py-4"
                    >
                      {syncProducts.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-5 h-5" />
                      )}
                      <span className="text-xs">Produtos</span>
                    </Button>
                    
                    <Button
                      onClick={() => syncInventory.mutate()}
                      disabled={syncInventory.isPending || syncStatus?.isRunning}
                      variant="outline"
                      className="h-auto flex-col gap-2 py-4"
                    >
                      {syncInventory.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-5 h-5" />
                      )}
                      <span className="text-xs">Estoque</span>
                    </Button>
                    
                    <Button
                      onClick={() => syncSales.mutate()}
                      disabled={syncSales.isPending || syncStatus?.isRunning}
                      variant="outline"
                      className="h-auto flex-col gap-2 py-4"
                    >
                      {syncSales.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-5 h-5" />
                      )}
                      <span className="text-xs">Vendas</span>
                    </Button>
                    
                    <Button
                      onClick={() => syncSuppliers.mutate()}
                      disabled={syncSuppliers.isPending || syncStatus?.isRunning}
                      variant="outline"
                      className="h-auto flex-col gap-2 py-4"
                    >
                      {syncSuppliers.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-5 h-5" />
                      )}
                      <span className="text-xs">Fornecedores</span>
                    </Button>
                  </div>
                  
                  {/* Indicador de Progresso */}
                  {syncStatus?.isRunning && syncStatus.currentSync && (
                    <Card className="border-primary/50 bg-primary/5">
                      <CardContent className="pt-6 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <span className="font-medium">
                              Sincronizando {syncStatus.currentSync.syncType === 'products' ? 'Produtos' : 
                                             syncStatus.currentSync.syncType === 'inventory' ? 'Estoque' :
                                             syncStatus.currentSync.syncType === 'sales' ? 'Vendas' :
                                             syncStatus.currentSync.syncType === 'suppliers' ? 'Fornecedores' :
                                             syncStatus.currentSync.syncType === 'full' ? 'Tudo' : syncStatus.currentSync.syncType}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {syncStatus.currentSync.progress?.current || 0} itens processados
                          </span>
                        </div>
                        
                        {syncStatus.currentSync.progress && syncStatus.currentSync.progress.total > 0 && (
                          <div className="space-y-1">
                            <Progress 
                              value={(syncStatus.currentSync.progress.current / syncStatus.currentSync.progress.total) * 100} 
                              className="h-2"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{syncStatus.currentSync.progress.current} / {syncStatus.currentSync.progress.total}</span>
                              <span>{Math.round((syncStatus.currentSync.progress.current / syncStatus.currentSync.progress.total) * 100)}%</span>
                            </div>
                          </div>
                        )}
                        
                        {syncStatus.currentSync.progress?.message && (
                          <p className="text-sm text-muted-foreground">{syncStatus.currentSync.progress.message}</p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  
                  <Separator />
                  
                  <div className="flex justify-center">
                    <Button
                      onClick={handleSync}
                      disabled={syncAll.isPending || syncStatus?.isRunning}
                      size="lg"
                      className="w-full md:w-auto"
                    >
                      {(syncAll.isPending || syncStatus?.isRunning) ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      {syncStatus?.isRunning ? "Sincronizando..." : "Sincronizar Tudo"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configuração de Situações Válidas */}
          {hasConfig && config?.isActive && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  4. Situações de Pedidos Válidas
                </CardTitle>
                <CardDescription>
                  Selecione quais situações de pedidos devem ser consideradas nos relatórios
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <OrderStatusFilter />
              </CardContent>
            </Card>
          )}

          {/* Configuração de Sincronização Automática */}
          {hasConfig && config?.isActive && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  5. Sincronização Automática
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
      
      {/* Modal de Visualização de Pedidos de Teste */}
      <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Pedidos de Venda - Teste de Busca</DialogTitle>
            <DialogDescription>
              {testOrdersData?.count || 0} pedidos encontrados nos últimos 30 dias
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[60vh] pr-4">
            {testOrdersData?.pedidos && testOrdersData.pedidos.length > 0 ? (
              <div className="space-y-4">
                {testOrdersData.pedidos.map((pedido: any, index: number) => (
                  <Card key={pedido.id || index}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          Pedido #{pedido.numero}
                        </CardTitle>
                        <Badge variant={pedido.situacao?.valor === 1 ? "default" : "secondary"}>
                          Situação ID: {pedido.situacao?.id}
                        </Badge>
                      </div>
                      <CardDescription>
                        ID Bling: {pedido.id} | Data: {pedido.data}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Informações do Cliente */}
                      {pedido.contato && (
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-sm font-medium mb-1">Cliente</p>
                          <p className="text-sm">{pedido.contato.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {pedido.contato.tipoPessoa === 'J' ? 'CNPJ' : 'CPF'}: {pedido.contato.numeroDocumento}
                          </p>
                        </div>
                      )}
                      
                      {/* Informações do Pedido */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Total Produtos</p>
                          <p className="text-sm font-medium">{pedido.totalProdutos}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Valor Total</p>
                          <p className="text-sm font-medium">R$ {pedido.total?.toFixed(2)}</p>
                        </div>
                        {pedido.dataSaida && (
                          <div>
                            <p className="text-xs text-muted-foreground">Data Saída</p>
                            <p className="text-sm font-medium">{pedido.dataSaida}</p>
                          </div>
                        )}
                        {pedido.dataPrevista && (
                          <div>
                            <p className="text-xs text-muted-foreground">Data Prevista</p>
                            <p className="text-sm font-medium">{pedido.dataPrevista}</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Itens do Pedido */}
                      {pedido.itens && pedido.itens.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Itens ({pedido.itens.length})</p>
                          <div className="space-y-2">
                            {pedido.itens.slice(0, 3).map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm bg-muted/30 p-2 rounded">
                                <div className="flex-1">
                                  <p className="font-medium">{item.produto?.nome || 'Produto sem nome'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Código: {item.produto?.codigo || 'N/A'} | ID: {item.produto?.id}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-medium">{item.quantidade}x R$ {item.valor?.toFixed(2)}</p>
                                  {item.desconto > 0 && (
                                    <p className="text-xs text-orange-600">Desc: R$ {item.desconto?.toFixed(2)}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {pedido.itens.length > 3 && (
                              <p className="text-xs text-muted-foreground text-center">
                                + {pedido.itens.length - 3} itens adicionais
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Loja */}
                      {pedido.loja && (
                        <div className="text-xs text-muted-foreground">
                          Loja: {pedido.loja.nome} (ID: {pedido.loja.id})
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum pedido encontrado
              </div>
            )}
          </ScrollArea>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowTestModal(false)}>
              Fechar
            </Button>
            <Button 
              onClick={() => {
                console.log('Dados completos:', testOrdersData);
                toast.success('Dados completos exibidos no console (F12)');
              }}
            >
              Ver JSON Completo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
