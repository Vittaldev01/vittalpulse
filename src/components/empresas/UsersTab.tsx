import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { UserCard } from "./UserCard";
import { CreateUserForEmpresaDialog } from "./CreateUserForEmpresaDialog";
import { EditUserDialog } from "./EditUserDialog";
import { UserStatsCards } from "./UserStatsCards";
import { useAllUsers } from "@/hooks/useSuperAdminUsers";
import { useEmpresas } from "@/hooks/useEmpresas";
import { Skeleton } from "@/components/ui/skeleton";

export const UsersTab = () => {
  const { data: users, isLoading } = useAllUsers();
  const { data: empresas } = useEmpresas();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [empresaFilter, setEmpresaFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = users?.filter((user) => {
    const userRole = Array.isArray(user.user_roles) && user.user_roles.length > 0 
      ? user.user_roles[0].role 
      : null;
    
    const matchesEmpresa = empresaFilter === "all" || user.empresa_id === empresaFilter;
    const matchesRole = roleFilter === "all" || userRole === roleFilter;
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesEmpresa && matchesRole && matchesSearch;
  });

  const handleEdit = (user: any) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Usuários</h2>
          <p className="text-muted-foreground">Gerencie todos os usuários do sistema</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Stats Dashboard */}
      {!isLoading && users && users.length > 0 && (
        <UserStatsCards users={users} />
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Empresas</SelectItem>
            {empresas?.map((empresa) => (
              <SelectItem key={empresa.id} value={empresa.id}>
                {empresa.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Roles</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">Usuário</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users List */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </>
        ) : filteredUsers?.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum usuário encontrado</p>
          </div>
        ) : (
          filteredUsers?.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onEdit={() => handleEdit(user)}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      <CreateUserForEmpresaDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      {selectedUser && (
        <EditUserDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          user={selectedUser}
        />
      )}
    </div>
  );
};
