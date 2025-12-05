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
  
  // IDs das situações relevantes
  const RELEVANT_STATUS_IDS = [9, 10380]; // 9 = Atendido, 10380 = Faturado
  
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
    } else {
      // Se não houver configuração, marcar apenas IDs relevantes como ativos
      const selected: Record<number, boolean> = {};
      RELEVANT_STATUS_IDS.forEach(id => {
        selected[id] = true;
      });
      setSelectedStatuses(selected);
    }
  }, [validStatuses]);
  
  const handleToggle = (statusId: number | null) => {
    if (statusId === null) return;
    setSelectedStatuses(prev => ({
      ...prev,
      [statusId]: !prev[statusId],
    }));
  };
  
  const handleSave = () => {
    const statusesToSave = relevantStatuses.map(status => ({
      statusId: status.statusId!,
      statusName: status.status || `Situação ${status.statusId}`,
      isActive: selectedStatuses[status.statusId!] ?? false,
    }));
    
    saveStatuses.mutate(statusesToSave);
  };
  
  const handleSelectAll = () => {
    const selected: Record<number, boolean> = {};
    RELEVANT_STATUS_IDS.forEach(id => {
      selected[id] = true;
    });
    setSelectedStatuses(selected);
  };
  
  const handleDeselectAll = () => {
    const selected: Record<number, boolean> = {};
    RELEVANT_STATUS_IDS.forEach(id => {
      selected[id] = false;
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
  
  // Filtrar apenas situações relevantes
  const relevantStatuses = uniqueStatuses?.filter(status => 
    status.statusId !== null && RELEVANT_STATUS_IDS.includes(status.statusId)
  ) || [];
  
  if (relevantStatuses.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-sm text-muted-foreground">
          Nenhuma situação relevante encontrada. Sincronize pedidos primeiro.
        </p>
        <p className="text-xs text-muted-foreground">
          Situações relevantes: Atendido (ID 9) e Faturado (ID 10380)
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
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {selectedCount} de {relevantStatuses.length} situações selecionadas
        </p>
        <p className="text-xs text-muted-foreground">
          Apenas situações relevantes são exibidas: Atendido (ID 9) e Faturado (ID 10380)
        </p>
      </div>
      
      <div className="rounded-lg border divide-y">
        {relevantStatuses.map((status) => {
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
