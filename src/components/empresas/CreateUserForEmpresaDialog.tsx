import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateUserForEmpresa } from "@/hooks/useSuperAdminUsers";
import { useEmpresas } from "@/hooks/useEmpresas";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";

interface CreateUserForEmpresaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateUserForEmpresaDialog = ({
  open,
  onOpenChange,
}: CreateUserForEmpresaDialogProps) => {
  const { data: empresas } = useEmpresas();
  const createUser = useCreateUserForEmpresa();
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    empresaId: "",
    role: "admin",
  });
  const [tempPassword, setTempPassword] = useState("");
  const [existingUserWarning, setExistingUserWarning] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExistingUserWarning(false);
    try {
      const result = await createUser.mutateAsync(formData);
      if (result.success && result.tempPassword) {
        setTempPassword(result.tempPassword);
      } else if (result.isExistingUser) {
        setExistingUserWarning(true);
      }
    } catch (error: any) {
      // Check if this is an existing user error from the response
      if (error.message?.includes("já está cadastrado")) {
        setExistingUserWarning(true);
      } else {
        console.error("Error creating user:", error);
      }
    }
  };

  const handleClose = () => {
    setFormData({ email: "", fullName: "", empresaId: "", role: "admin" });
    setTempPassword("");
    setExistingUserWarning(false);
    onOpenChange(false);
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    toast.success("Senha copiada!");
  };

  if (tempPassword) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuário Criado com Sucesso!</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Senha temporária:</strong> Compartilhe esta senha com o usuário. 
                Ele deverá alterá-la no primeiro login.
              </AlertDescription>
            </Alert>
            
            <div className="flex items-center gap-2 p-4 bg-muted rounded-md">
              <code className="flex-1 font-mono text-sm">{tempPassword}</code>
              <Button onClick={copyPassword} size="sm" variant="outline">
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>Email:</strong> {formData.email}</p>
              <p><strong>Nome:</strong> {formData.fullName}</p>
            </div>

            <Button onClick={handleClose} className="w-full">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Novo Usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {existingUserWarning && (
            <Alert variant="default" className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Este email já está cadastrado no sistema. Verifique na lista de usuários para editar suas informações.
              </AlertDescription>
            </Alert>
          )}
          
          <div>
            <Label htmlFor="fullName">Nome Completo</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
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
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={createUser.isPending} className="flex-1">
              {createUser.isPending ? "Criando..." : "Criar Usuário"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
