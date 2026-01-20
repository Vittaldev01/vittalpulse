import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Copy, Eye, EyeOff } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-admin-user", {
        body: {
          email: email.trim(),
          fullName: fullName.trim(),
          role: "admin",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setTempPassword(data.tempPassword);
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast({
        title: "Usuário criado com sucesso!",
        description: "Copie a senha temporária abaixo e compartilhe com o usuário.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !fullName) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha email e nome completo.",
        variant: "destructive",
      });
      return;
    }

    createUserMutation.mutate();
  };

  const handleClose = () => {
    setEmail("");
    setFullName("");
    setTempPassword("");
    setShowPassword(false);
    onOpenChange(false);
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    toast({
      title: "Senha copiada!",
      description: "Senha temporária copiada para a área de transferência.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Adicionar Novo Usuário Admin
          </DialogTitle>
          <DialogDescription>
            Crie um novo usuário com acesso total ao sistema. O usuário será criado como
            administrador e terá as mesmas permissões que você.
          </DialogDescription>
        </DialogHeader>

        {!tempPassword ? (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo *</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Nome completo do usuário"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <Alert>
                <AlertDescription>
                  Uma senha temporária será gerada automaticamente. O usuário poderá
                  alterá-la após o primeiro login em Configurações.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={createUserMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 py-4">
            <Alert className="border-green-600 bg-green-50 dark:bg-green-950">
              <AlertTitle className="text-green-800 dark:text-green-200">
                Usuário criado com sucesso!
              </AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-300">
                Email: <strong>{email}</strong>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="tempPassword">Senha Temporária</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="tempPassword"
                    type={showPassword ? "text" : "password"}
                    value={tempPassword}
                    readOnly
                    className="pr-10 font-mono"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button type="button" variant="outline" onClick={copyPassword}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                ⚠️ <strong>IMPORTANTE:</strong> Copie esta senha e compartilhe com o usuário
                de forma segura. Esta é a única vez que ela será exibida. O usuário deve
                alterá-la no primeiro login.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
