import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function OrderStatusFilter() {
  const [selectedStatuses, setSelectedStatuses] = useState<Record<number, boolean>>({});
  
  // Buscar situações únicas dos pedidos importados
  const { data: uniqueStatuses, isLoading: loadingUnique, refetch } = trpc.bling.getUniqueOrderStatuses.useQuery();
  
  // Buscar situações válidas já configuradas
  const { data: validStatuses, isLoading: loadingValid } = trpc.bling.getValidOrderStatuses.useQuery();
  
  // Mutation para salvar configuração
  const saveStatuses = trpc.bling.saveValidOrderStatuses.useMutation({
    onSuccess: () => {
      toast.success("Configuração salva com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });
  
  // Inicializar seleção com situações válidas já configuradas
  useEffect(() => {
    if (validStatuses && validStatuses.length > 0) {
      const selected: Record<number, boolean> = {};
      validStatuses.forEach(status => {
        if (status.statusId !== null) {
          selected[status.statusId] = status.isActive;
        }
      });
      setSelectedStatuses(selected);
    } else if (uniqueStatuses && uniqueStatuses.length > 0) {
      // Se não houver configuração, marcar todas como ativas por padrão
      const selected: Record<number, boolean> = {};
      uniqueStatuses.forEach(status => {
        if (status.statusId !== null) {
          selected[status.statusId] = true;
        }
      });
      setSelectedStatuses(selected);
    }
  }, [validStatuses, uniqueStatuses]);
  
  const handleToggle = (statusId: number | null) => {
    if (statusId === null) return;
    setSelectedStatuses(prev => ({
      ...prev,
      [statusId]: !prev[statusId],
    }));
  };
  
  const handleSave = () => {
    if (!uniqueStatuses) return;
    
    const statusesToSave = uniqueStatuses
      .filter(status => status.statusId !== null)
      .map(status => ({
        statusId: status.statusId!,
        statusName: status.status || `Situação ${status.statusId}`,
        isActive: selectedStatuses[status.statusId!] ?? false,
      }));
    
    saveStatuses.mutate(statusesToSave);
  };
  
  const handleSelectAll = () => {
    if (!uniqueStatuses) return;
    const selected: Record<number, boolean> = {};
    uniqueStatuses.forEach(status => {
      if (status.statusId !== null) {
        selected[status.statusId] = true;
      }
    });
    setSelectedStatuses(selected);
  };
  
  const handleDeselectAll = () => {
    if (!uniqueStatuses) return;
    const selected: Record<number, boolean> = {};
    uniqueStatuses.forEach(status => {
      if (status.statusId !== null) {
        selected[status.statusId] = false;
      }
    });
    setSelectedStatuses(selected);
  };
  
  if (loadingUnique || loadingValid) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!uniqueStatuses || uniqueStatuses.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-sm text-muted-foreground">
          Nenhuma situação encontrada. Sincronize pedidos primeiro.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>
    );
  }
  
  const selectedCount = Object.values(selectedStatuses).filter(Boolean).length;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedCount} de {uniqueStatuses.length} situações selecionadas
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
          >
            Selecionar Todas
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeselectAll}
          >
            Desmarcar Todas
          </Button>
        </div>
      </div>
      
      <div className="rounded-lg border divide-y">
        {uniqueStatuses.map((status) => {
          if (status.statusId === null) return null;
          return (
          <div
            key={status.statusId}
            className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
          >
            <Checkbox
              id={`status-${status.statusId}`}
              checked={selectedStatuses[status.statusId] ?? false}
              onCheckedChange={() => handleToggle(status.statusId)}
            />
            <label
              htmlFor={`status-${status.statusId}`}
              className="flex-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{status.status || `Situação ${status.statusId}`}</span>
                <span className="text-xs text-muted-foreground">ID: {status.statusId}</span>
              </div>
            </label>
          </div>
          );
        })}
      </div>
      
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saveStatuses.isPending}
        >
          {saveStatuses.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvar Configuração
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
