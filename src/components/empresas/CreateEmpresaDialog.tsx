import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateEmpresa } from "@/hooks/useEmpresas";
import { usePlanos } from "@/hooks/usePlanos";
import { Skeleton } from "@/components/ui/skeleton";

interface CreateEmpresaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateEmpresaDialog = ({ open, onOpenChange }: CreateEmpresaDialogProps) => {
  const createEmpresa = useCreateEmpresa();
  const { data: planos, isLoading: loadingPlanos } = usePlanos();
  const [selectedPlanoId, setSelectedPlanoId] = useState<string>("");
  const [formData, setFormData] = useState({
    nome: "",
    cnpj: "",
    email_contato: "",
    telefone: "",
    notas_internas: "",
    plano_nome: "",
    limite_disparos_mensal: 10000,
    limite_conexoes: 3,
    limite_contatos: 5000,
    limite_campanhas_simultaneas: 5,
  });
  const [features, setFeatures] = useState({
    follow_up: true,
    multi_conexao: true,
    ai_variations: false,
    campanhas_interativas: true,
  });

  // Initialize with first plan when planos are loaded
  useEffect(() => {
    if (planos && planos.length > 0 && !selectedPlanoId) {
      const firstPlano = planos[0];
      setSelectedPlanoId(firstPlano.id);
      handlePlanoChange(firstPlano.id);
    }
  }, [planos, selectedPlanoId]);

  const handlePlanoChange = (planoId: string) => {
    const plano = planos?.find((p) => p.id === planoId);
    if (plano) {
      setSelectedPlanoId(planoId);
      setFormData((prev) => ({
        ...prev,
        plano_nome: plano.nome,
        limite_disparos_mensal: plano.limite_disparos_mensal,
        limite_conexoes: plano.limite_conexoes,
        limite_contatos: plano.limite_contatos,
        limite_campanhas_simultaneas: plano.limite_campanhas_simultaneas,
      }));
      const planoFeatures = plano.features_habilitadas as any;
      setFeatures({
        follow_up: planoFeatures?.follow_up ?? true,
        multi_conexao: planoFeatures?.multi_conexao ?? true,
        ai_variations: planoFeatures?.ai_variations ?? false,
        campanhas_interativas: planoFeatures?.campanhas_interativas ?? true,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createEmpresa.mutateAsync({
      ...formData,
      features_habilitadas: features,
    });
    onOpenChange(false);
    // Reset form
    setFormData({
      nome: "",
      cnpj: "",
      email_contato: "",
      telefone: "",
      notas_internas: "",
      plano_nome: "",
      limite_disparos_mensal: 10000,
      limite_conexoes: 3,
      limite_contatos: 5000,
      limite_campanhas_simultaneas: 5,
    });
    setSelectedPlanoId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Empresa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados Básicos */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome da Empresa *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email de Contato *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email_contato}
                onChange={(e) => setFormData({ ...formData, email_contato: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Plano */}
          <div className="space-y-2">
            <Label>Plano</Label>
            {loadingPlanos ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="flex gap-2 flex-wrap">
                {planos?.map((plano) => (
                  <Button
                    key={plano.id}
                    type="button"
                    variant={selectedPlanoId === plano.id ? "default" : "outline"}
                    onClick={() => handlePlanoChange(plano.id)}
                    className="flex-1 min-w-[150px]"
                  >
                    {plano.nome}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Limites */}
          <div className="space-y-4">
            <Label>Limites do Plano</Label>
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
              </div>
              <div>
                <Label htmlFor="conexoes">Conexões</Label>
                <Input
                  id="conexoes"
                  type="number"
                  value={formData.limite_conexoes}
                  onChange={(e) => setFormData({ ...formData, limite_conexoes: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="contatos">Contatos</Label>
                <Input
                  id="contatos"
                  type="number"
                  value={formData.limite_contatos}
                  onChange={(e) => setFormData({ ...formData, limite_contatos: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="campanhas">Campanhas Simultâneas</Label>
                <Input
                  id="campanhas"
                  type="number"
                  value={formData.limite_campanhas_simultaneas}
                  onChange={(e) =>
                    setFormData({ ...formData, limite_campanhas_simultaneas: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-3">
            <Label>Features</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="follow_up"
                  checked={features.follow_up}
                  onCheckedChange={(checked) =>
                    setFeatures({ ...features, follow_up: checked as boolean })
                  }
                />
                <Label htmlFor="follow_up" className="font-normal cursor-pointer">
                  Follow-up
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="multi_conexao"
                  checked={features.multi_conexao}
                  onCheckedChange={(checked) =>
                    setFeatures({ ...features, multi_conexao: checked as boolean })
                  }
                />
                <Label htmlFor="multi_conexao" className="font-normal cursor-pointer">
                  Multi-conexão
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ai_variations"
                  checked={features.ai_variations}
                  onCheckedChange={(checked) =>
                    setFeatures({ ...features, ai_variations: checked as boolean })
                  }
                />
                <Label htmlFor="ai_variations" className="font-normal cursor-pointer">
                  IA Variações
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="campanhas_interativas"
                  checked={features.campanhas_interativas}
                  onCheckedChange={(checked) =>
                    setFeatures({ ...features, campanhas_interativas: checked as boolean })
                  }
                />
                <Label htmlFor="campanhas_interativas" className="font-normal cursor-pointer">
                  Campanhas Interativas
                </Label>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <Label htmlFor="notas">Notas Internas</Label>
            <Textarea
              id="notas"
              value={formData.notas_internas}
              onChange={(e) => setFormData({ ...formData, notas_internas: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createEmpresa.isPending}>
              {createEmpresa.isPending ? "Criando..." : "Criar Empresa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
