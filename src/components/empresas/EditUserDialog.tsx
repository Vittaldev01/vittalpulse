import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateUserEmpresa, useUpdateUserRole } from "@/hooks/useSuperAdminUsers";
import { useEmpresas } from "@/hooks/useEmpresas";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
}

export const EditUserDialog = ({ open, onOpenChange, user }: EditUserDialogProps) => {
  const { data: empresas } = useEmpresas();
  const updateEmpresa = useUpdateUserEmpresa();
  const updateRole = useUpdateUserRole();
  const [formData, setFormData] = useState({
    empresaId: user.empresa_id || "",
    role: user.user_roles?.[0]?.role || "user",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.empresaId !== user.empresa_id) {
        await updateEmpresa.mutateAsync({ userId: user.id, empresaId: formData.empresaId });
      }
      if (formData.role !== user.user_roles?.[0]?.role) {
        await updateRole.mutateAsync({ userId: user.id, role: formData.role });
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Nome:</strong> {user.full_name}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Email:</strong> {user.email}
            </p>
          </div>

          <div>
            <Label htmlFor="empresa">Empresa</Label>
            <Select
              value={formData.empresaId}
              onValueChange={(value) => setFormData({ ...formData, empresaId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas?.map((empresa) => (
                  <SelectItem key={empresa.id} value={empresa.id}>
                    {empresa.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="role">Role</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={updateEmpresa.isPending || updateRole.isPending} 
              className="flex-1"
            >
              {(updateEmpresa.isPending || updateRole.isPending) ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
