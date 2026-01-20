import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import CreateUserDialog from "./CreateUserDialog";

export default function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at, approved")
        .eq("approved", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: allUsers } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at, approved, approved_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      // 1. Aprovar o perfil
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          approved: true,
          approved_at: new Date().toISOString(),
          approved_by: currentUser?.id,
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      // 2. Atribuir role admin
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "admin",
        });

      if (roleError) throw roleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast({
        title: "Usuário aprovado!",
        description: "O usuário agora pode acessar o sistema.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao aprovar",
        description: "Não foi possível aprovar o usuário.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <CreateUserDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Usuários Pendentes de Aprovação
              </CardTitle>
              <CardDescription>
                Aprove novos usuários para que possam acessar o sistema
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Carregando...</div>
          ) : pendingUsers && pendingUsers.length > 0 ? (
            <div className="space-y-4">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg bg-background"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{user.full_name || "Sem nome"}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Cadastrado em: {new Date(user.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <Button
                    onClick={() => approveMutation.mutate(user.id)}
                    disabled={approveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Aprovar
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Não há usuários pendentes de aprovação
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Todos os Usuários</CardTitle>
          <CardDescription>Lista completa de usuários do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {allUsers && allUsers.length > 0 ? (
            <div className="space-y-4">
              {allUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg bg-background"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{user.full_name || "Sem nome"}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Cadastrado em: {new Date(user.created_at).toLocaleString("pt-BR")}
                    </p>
                    {user.approved_at && (
                      <p className="text-xs text-muted-foreground">
                        Aprovado em: {new Date(user.approved_at).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={user.approved ? "default" : "secondary"}
                    className={user.approved ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                  >
                    {user.approved ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Aprovado
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3 mr-1" />
                        Pendente
                      </>
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Nenhum usuário cadastrado
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
