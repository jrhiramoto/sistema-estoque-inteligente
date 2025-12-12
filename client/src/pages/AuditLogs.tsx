import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Home, FileText, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const ACTION_LABELS: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  user_created: "Usuário Criado",
  user_updated: "Usuário Atualizado",
  user_deleted: "Usuário Excluído",
  password_changed: "Senha Alterada",
  password_reset: "Senha Resetada",
  permission_granted: "Permissão Concedida",
  permission_revoked: "Permissão Revogada",
};

const ACTION_COLORS: Record<string, string> = {
  login: "bg-green-500",
  logout: "bg-gray-500",
  user_created: "bg-blue-500",
  user_updated: "bg-yellow-500",
  user_deleted: "bg-red-500",
  password_changed: "bg-purple-500",
  password_reset: "bg-orange-500",
  permission_granted: "bg-indigo-500",
  permission_revoked: "bg-pink-500",
};

export default function AuditLogs() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    action: "",
    startDate: "",
    endDate: "",
  });
  const [page, setPage] = useState(0);
  const limit = 50;

  // Verificar permissão
  if (!user || (user.role !== "master" && user.role !== "admin")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8">
          <p className="text-red-600">Acesso negado. Apenas master e administradores podem acessar logs de auditoria.</p>
          <Button onClick={() => navigate("/")} className="mt-4">
            Voltar ao Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const { data, isLoading, refetch } = trpc.audit.list.useQuery({
    action: filters.action || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    limit,
    offset: page * limit,
  });

  const handleFilterChange = () => {
    setPage(0);
    refetch();
  };

  const handleClearFilters = () => {
    setFilters({
      action: "",
      startDate: "",
      endDate: "",
    });
    setPage(0);
    refetch();
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("pt-BR");
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
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
                <FileText className="h-8 w-8" />
                Logs de Auditoria
              </h1>
              <p className="text-gray-600 mt-1">
                Histórico de ações realizadas no sistema
              </p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>
              Filtre os logs por tipo de ação e período
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Tipo de Ação</Label>
                <Select
                  value={filters.action}
                  onValueChange={(value) => setFilters({ ...filters, action: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {Object.entries(ACTION_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>

              <div>
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>

              <div className="flex items-end gap-2">
                <Button onClick={handleFilterChange} className="flex-1">
                  Aplicar
                </Button>
                <Button onClick={handleClearFilters} variant="outline">
                  Limpar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs */}
        <Card>
          <CardHeader>
            <CardTitle>
              Registros ({data?.total || 0})
            </CardTitle>
            <CardDescription>
              Página {page + 1} de {totalPages || 1}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : data && data.logs.length > 0 ? (
              <>
                <div className="space-y-3">
                  {data.logs.map((log) => (
                    <div
                      key={log.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={ACTION_COLORS[log.action] || "bg-gray-500"}>
                              {ACTION_LABELS[log.action] || log.action}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              {formatDate(log.createdAt)}
                            </span>
                          </div>

                          <div className="text-sm space-y-1">
                            {log.userId && (
                              <p>
                                <span className="font-medium">Usuário:</span> ID {log.userId}
                              </p>
                            )}
                            {log.ipAddress && (
                              <p>
                                <span className="font-medium">IP:</span> {log.ipAddress}
                              </p>
                            )}
                            {log.details && (
                              <p>
                                <span className="font-medium">Detalhes:</span>{" "}
                                {JSON.stringify(log.details)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Paginação */}
                <div className="flex items-center justify-between mt-6 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Anterior
                  </Button>

                  <span className="text-sm text-gray-600">
                    Página {page + 1} de {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Nenhum log encontrado
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
