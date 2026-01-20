import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import UserManagement from "@/components/UserManagement";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Lock } from "lucide-react";

export default function Settings() {
  const { data: userRole } = useUserRole();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = userRole === "admin";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "A nova senha e a confirmação devem ser iguais.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Senha alterada!",
        description: "Sua senha foi atualizada com sucesso.",
      });
      setNewPassword("");
      setConfirmPassword("");
    }
    setIsUpdating(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas preferências e integrações</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="preferences">Preferências</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">Usuários</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile">
          <div className="space-y-6">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Informações do Perfil</CardTitle>
                <CardDescription>Suas informações de conta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={user?.email || ""} 
                    disabled 
                    className="bg-muted"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Alterar Senha
                </CardTitle>
                <CardDescription>Atualize sua senha de acesso</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova Senha</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isUpdating}
                  >
                    {isUpdating ? "Atualizando..." : "Alterar Senha"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="integrations">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">Integrações</CardTitle>
              <CardDescription>Configure suas integrações externas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="uazapi">Uazapi API Token</Label>
                <Input id="uazapi" type="password" placeholder="Seu token da Uazapi" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="openai">OpenAI API Key</Label>
                <Input id="openai" type="password" placeholder="Sua chave da OpenAI" />
              </div>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Salvar Integrações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">Preferências</CardTitle>
              <CardDescription>Personalize sua experiência</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Configurações de notificações e preferências serão adicionadas aqui
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users">
            <UserManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
