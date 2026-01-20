import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PlanoCard } from "./PlanoCard";
import { CreatePlanoDialog } from "./CreatePlanoDialog";
import { EditPlanoDialog } from "./EditPlanoDialog";
import { usePlanos } from "@/hooks/usePlanos";
import { Skeleton } from "@/components/ui/skeleton";

export const PlanosTab = () => {
  const { data: planos, isLoading } = usePlanos();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState<any>(null);

  const handleEdit = (plano: any) => {
    setSelectedPlano(plano);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Planos</h2>
          <p className="text-muted-foreground">Gerencie os planos disponíveis no sistema</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      {/* Planos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-96 w-full" />
            ))}
          </>
        ) : planos?.length === 0 ? (
          <div className="col-span-3 text-center py-12">
            <p className="text-muted-foreground">Nenhum plano encontrado</p>
          </div>
        ) : (
          planos?.map((plano) => (
            <PlanoCard
              key={plano.id}
              plano={plano}
              onEdit={() => handleEdit(plano)}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      <CreatePlanoDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      {selectedPlano && (
        <EditPlanoDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          plano={selectedPlano}
        />
      )}
    </div>
  );
};
