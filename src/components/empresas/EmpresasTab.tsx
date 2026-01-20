import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { EmpresaCard } from "./EmpresaCard";
import { CreateEmpresaDialog } from "./CreateEmpresaDialog";
import { EditEmpresaDialog } from "./EditEmpresaDialog";
import { useEmpresas } from "@/hooks/useEmpresas";
import { Skeleton } from "@/components/ui/skeleton";

export const EmpresasTab = () => {
  const { data: empresas, isLoading } = useEmpresas();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEmpresas = empresas?.filter((empresa) => {
    const matchesStatus = statusFilter === "all" || empresa.status === statusFilter;
    const matchesSearch = empresa.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         empresa.email_contato.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleEdit = (empresa: any) => {
    setSelectedEmpresa(empresa);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Empresas</h2>
          <p className="text-muted-foreground">Gerencie todas as empresas do sistema</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Empresa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="suspenso">Suspenso</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Empresas List */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </>
        ) : filteredEmpresas?.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma empresa encontrada</p>
          </div>
        ) : (
          filteredEmpresas?.map((empresa) => (
            <EmpresaCard
              key={empresa.id}
              empresa={empresa}
              onEdit={() => handleEdit(empresa)}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      <CreateEmpresaDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      {selectedEmpresa && (
        <EditEmpresaDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          empresa={selectedEmpresa}
        />
      )}
    </div>
  );
};
