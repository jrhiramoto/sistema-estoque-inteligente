import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ALERT_TYPES, ALERT_SEVERITIES } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Alerts() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  
  const { data: alerts, isLoading } = trpc.alerts.list.useQuery(
    undefined,
    { 
      enabled: !!user,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const resolveAlert = trpc.alerts.resolve.useMutation({
    onSuccess: () => {
      utils.alerts.list.invalidate();
      toast.success("Alerta resolvido com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao resolver alerta");
    },
  });

  const getSeverityColor = (severity: string): "default" | "secondary" | "outline" | "destructive" => {
    const colors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      critical: "destructive",
      high: "destructive",
      medium: "default",
      low: "secondary",
    };
    return colors[severity] || "secondary";
  };

  const formatDate = (date: Date) => {
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
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </Link>
          
          <h1 className="text-3xl font-bold mb-2">Alertas</h1>
          <p className="text-muted-foreground">
            Gerencie alertas e notificações do sistema
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : alerts && alerts.length > 0 ? (
          <div className="space-y-4">
            {alerts.map((alert) => {
              const alertType = ALERT_TYPES[alert.alertType as keyof typeof ALERT_TYPES];
              const severity = ALERT_SEVERITIES[alert.severity as keyof typeof ALERT_SEVERITIES];
              
              return (
                <Card key={alert.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={getSeverityColor(alert.severity)}>
                            {severity?.label || alert.severity}
                          </Badge>
                          <Badge variant="outline">
                            {alertType?.label || alert.alertType}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg">{alert.message}</CardTitle>
                        <CardDescription className="mt-1">
                          Criado em {formatDate(alert.createdAt)}
                        </CardDescription>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveAlert.mutate({ alertId: alert.id })}
                        disabled={resolveAlert.isPending}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Resolver
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhum alerta ativo</h3>
                <p className="text-muted-foreground">
                  Tudo está funcionando perfeitamente! Não há alertas pendentes no momento.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
