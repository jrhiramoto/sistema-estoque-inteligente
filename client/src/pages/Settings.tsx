import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Save, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  
  const { data: config, isLoading } = trpc.bling.getConfig.useQuery(
    undefined,
    { enabled: !!user }
  );

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");

  useEffect(() => {
    if (config) {
      setClientId(config.clientId || "");
      setClientSecret(config.clientSecret || "");
      setAccessToken(config.accessToken || "");
    }
  }, [config]);

  const saveConfig = trpc.bling.saveConfig.useMutation({
    onSuccess: () => {
      utils.bling.getConfig.invalidate();
      toast.success("Configurações salvas com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao salvar configurações");
    },
  });

  const handleSave = () => {
    saveConfig.mutate({
      clientId: clientId || undefined,
      clientSecret: clientSecret || undefined,
      accessToken: accessToken || undefined,
    });
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
            Configure a integração com o Bling e outros parâmetros do sistema
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integração com Bling ERP</CardTitle>
              <CardDescription>
                Configure suas credenciais de API do Bling para sincronização automática de produtos, estoque e vendas
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

                  <div className="space-y-2">
                    <Label htmlFor="accessToken">Access Token</Label>
                    <Input
                      id="accessToken"
                      type="password"
                      placeholder="Seu Access Token do Bling"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Você pode obter suas credenciais no{" "}
                      <a
                        href="https://developer.bling.com.br"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center"
                      >
                        Portal de Desenvolvedores do Bling
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </p>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleSave}
                      disabled={saveConfig.isPending}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Configurações
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Importação Manual</CardTitle>
              <CardDescription>
                Se você não possui integração com o Bling, pode importar dados manualmente via CSV
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Funcionalidade de importação CSV será implementada em breve. Por enquanto, 
                  configure a integração com o Bling para sincronização automática.
                </p>
                <Button variant="outline" disabled>
                  Importar CSV (Em breve)
                </Button>
              </div>
            </CardContent>
          </Card>

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
                  <li>Integração com Bling ERP</li>
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
