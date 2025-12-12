import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, KeyRound, User, Mail, Shield, Monitor, Smartphone, Tablet, MapPin, Clock, X } from "lucide-react";
import { toast } from "sonner";

function SessionsCard() {
  const { data: sessionsData, isLoading, refetch } = trpc.sessions.list.useQuery();
  const revokeSessionMutation = trpc.sessions.revoke.useMutation({
    onSuccess: () => {
      toast.success(" Sessão desconectada com sucesso!");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao desconectar sessão");
    },
  });

  const revokeOthersMutation = trpc.sessions.revokeOthers.useMutation({
    onSuccess: () => {
      toast.success("Todas as outras sessões foram desconectadas!");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao desconectar sessões");
    },
  });

  const getDeviceIcon = (deviceType?: string) => {
    if (deviceType === "Mobile") return <Smartphone className="h-4 w-4" />;
    if (deviceType === "Tablet") return <Tablet className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("pt-BR");
  };

  const handleRevokeSession = (sessionId: number) => {
    if (confirm("Deseja realmente desconectar esta sessão?")) {
      revokeSessionMutation.mutate({ sessionId });
    }
  };

  const handleRevokeOthers = () => {
    if (confirm("Deseja desconectar todas as outras sessões?")) {
      revokeOthersMutation.mutate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Sessões Ativas
            </CardTitle>
            <CardDescription>
              Gerencie os dispositivos conectados à sua conta
            </CardDescription>
          </div>
          {sessionsData && sessionsData.sessions.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeOthers}
              disabled={revokeOthersMutation.isPending}
            >
              Desconectar Outras
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : sessionsData && sessionsData.sessions.length > 0 ? (
          <div className="space-y-3">
            {sessionsData.sessions.map((session) => {
              const deviceInfo = session.deviceInfo || {};
              return (
                <div
                  key={session.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {getDeviceIcon(deviceInfo.deviceType)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="font-medium">
                          {deviceInfo.browser || "Navegador Desconhecido"} em{" "}
                          {deviceInfo.os || "Sistema Desconhecido"}
                        </div>
                        <div className="text-sm text-gray-500 space-y-1">
                          {session.ipAddress && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {session.ipAddress}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Última atividade: {formatDate(session.lastActivity)}
                          </div>
                          <div className="text-xs text-gray-400">
                            Criado em: {formatDate(session.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={revokeSessionMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Nenhuma sessão ativa encontrada
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const changePasswordMutation = trpc.users.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao alterar senha");
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (formData.newPassword.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres");
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword,
    });
  };

  const getRoleBadge = (role: string) => {
    if (role === "master") {
      return <Badge className="bg-purple-500">Master</Badge>;
    }
    if (role === "admin") {
      return <Badge className="bg-blue-500">Admin</Badge>;
    }
    return <Badge variant="secondary">Usuário</Badge>;
  };

  const getPermissionsBadges = (permissions: string[]) => {
    if (!permissions || permissions.length === 0) {
      return <span className="text-gray-400 text-sm">Nenhuma</span>;
    }
    
    return (
      <div className="flex gap-1 flex-wrap">
        {permissions.includes("manage_users") && (
          <Badge variant="outline" className="text-xs">Gerenciar Usuários</Badge>
        )}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/")}
            >
              <Home className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <User className="h-8 w-8" />
                Meu Perfil
              </h1>
              <p className="text-gray-600 mt-1">
                Gerencie suas informações pessoais
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Informações do Usuário */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Pessoais</CardTitle>
              <CardDescription>
                Seus dados cadastrados no sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Nome</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{user.name}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500">Email</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{user.email}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-gray-500">Nível de Acesso</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Shield className="h-4 w-4 text-gray-400" />
                    {getRoleBadge(user.role)}
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500">Permissões</Label>
                  <div className="mt-1">
                    {getPermissionsBadges(user.permissions || [])}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sessões Ativas */}
          <SessionsCard />

          {/* Alterar Senha */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Alterar Senha
              </CardTitle>
              <CardDescription>
                Mantenha sua conta segura alterando sua senha regularmente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Senha Atual</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={formData.currentPassword}
                    onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                    placeholder="Digite sua senha atual"
                    disabled={changePasswordMutation.isPending}
                  />
                </div>

                <div>
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    disabled={changePasswordMutation.isPending}
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Digite a nova senha novamente"
                    disabled={changePasswordMutation.isPending}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                >
                  {changePasswordMutation.isPending ? "Alterando..." : "Alterar Senha"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
