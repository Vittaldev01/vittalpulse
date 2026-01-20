import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useUpdateEmpresa, useResetDispatchCounter } from "@/hooks/useEmpresas";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface EditEmpresaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: any;
}

export const EditEmpresaDialog = ({ open, onOpenChange, empresa }: EditEmpresaDialogProps) => {
  const updateEmpresa = useUpdateEmpresa();
  const resetCounter = useResetDispatchCounter();
  const [formData, setFormData] = useState(empresa);
  const [features, setFeatures] = useState(empresa?.features_habilitadas || {});

  useEffect(() => {
    if (empresa) {
      setFormData(empresa);
      setFeatures(empresa.features_habilitadas || {});
    }
  }, [empresa]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Extrair APENAS os campos que existem na tabela empresas
    const { 
      active_campaigns_count, 
      connections_count, 
      contacts_count, 
      users_count,
      profiles,
      ...validData 
    } = formData;
    
    await updateEmpresa.mutateAsync({
      id: empresa.id,
      data: {
        ...validData,
        features_habilitadas: features,
      },
    });
    onOpenChange(false);
  };

  const handleResetCounter = async () => {
    if (confirm("Tem certeza que deseja resetar o contador de disparos?")) {
      await resetCounter.mutateAsync(empresa.id);
    }
  };

  const usagePercentage = empresa?.limite_disparos_mensal > 0
    ? (empresa.disparos_usados_mes_atual / empresa.limite_disparos_mensal) * 100
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar: {empresa?.nome}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="limites">Limites</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="uso">Uso</TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit}>
            <TabsContent value="dados" className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj || ""}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone || ""}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={formData.email_contato}
                  onChange={(e) => setFormData({ ...formData, email_contato: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspenso">Suspenso</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="limites" className="space-y-4">
              <div>
                <Label htmlFor="plano">Plano</Label>
                <Select
                  value={formData.plano_nome}
                  onValueChange={(value) => setFormData({ ...formData, plano_nome: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basico">Básico</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="empresarial">Empresarial</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="disparos">Disparos/mês</Label>
                  <Input
                    id="disparos"
                    type="number"
                    value={formData.limite_disparos_mensal}
                    onChange={(e) =>
                      setFormData({ ...formData, limite_disparos_mensal: parseInt(e.target.value) })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Usado: {empresa?.disparos_usados_mes_atual.toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label htmlFor="conexoes">Conexões</Label>
                  <Input
                    id="conexoes"
                    type="number"
                    value={formData.limite_conexoes}
                    onChange={(e) => setFormData({ ...formData, limite_conexoes: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Usado: {empresa?.connections_count}
                  </p>
                </div>
                <div>
                  <Label htmlFor="contatos">Contatos</Label>
                  <Input
                    id="contatos"
                    type="number"
                    value={formData.limite_contatos}
                    onChange={(e) => setFormData({ ...formData, limite_contatos: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Usado: {empresa?.contacts_count.toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label htmlFor="campanhas">Campanhas</Label>
                  <Input
                    id="campanhas"
                    type="number"
                    value={formData.limite_campanhas_simultaneas}
                    onChange={(e) =>
                      setFormData({ ...formData, limite_campanhas_simultaneas: parseInt(e.target.value) })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Usado: {empresa?.active_campaigns_count}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <p className="text-sm font-medium">Data de Renovação</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(empresa?.data_renovacao || new Date()), "dd/MM/yyyy")}
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={handleResetCounter}>
                  Resetar Contador
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="features" className="space-y-3">
              {Object.entries(features).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={value as boolean}
                    onCheckedChange={(checked) =>
                      setFeatures({ ...features, [key]: checked as boolean })
                    }
                  />
                  <Label htmlFor={key} className="font-normal cursor-pointer">
                    {key === "follow_up" && "Follow-up"}
                    {key === "multi_conexao" && "Multi-conexão"}
                    {key === "ai_variations" && "IA Variações"}
                    {key === "campanhas_interativas" && "Campanhas Interativas"}
                  </Label>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="uso" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Uso de Disparos</span>
                    <Badge variant={usagePercentage > 90 ? "destructive" : "default"}>
                      {usagePercentage.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold">
                    {empresa?.disparos_usados_mes_atual.toLocaleString()} / {empresa?.limite_disparos_mensal.toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Conexões</p>
                    <p className="text-xl font-bold">{empresa?.connections_count} / {empresa?.limite_conexoes}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contatos</p>
                    <p className="text-xl font-bold">{empresa?.contacts_count.toLocaleString()} / {empresa?.limite_contatos.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Campanhas Ativas</p>
                    <p className="text-xl font-bold">{empresa?.active_campaigns_count} / {empresa?.limite_campanhas_simultaneas}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Usuários</p>
                    <p className="text-xl font-bold">{empresa?.users_count}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <div className="flex gap-2 justify-end mt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateEmpresa.isPending}>
                {updateEmpresa.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
