import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreatePlano } from "@/hooks/usePlanos";

interface CreatePlanoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreatePlanoDialog = ({ open, onOpenChange }: CreatePlanoDialogProps) => {
  const createPlano = useCreatePlano();
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    limite_disparos_mensal: 10000,
    limite_conexoes: 3,
    limite_contatos: 5000,
    limite_campanhas_simultaneas: 5,
    preco_mensal: 97.00,
  });
  const [features, setFeatures] = useState({
    follow_up: true,
    ai_variations: false,
    multi_conexao: true,
    campanhas_interativas: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPlano.mutateAsync({
        ...formData,
        features_habilitadas: features,
      });
      setFormData({
        nome: "",
        descricao: "",
        limite_disparos_mensal: 10000,
        limite_conexoes: 3,
        limite_contatos: 5000,
        limite_campanhas_simultaneas: 5,
        preco_mensal: 97.00,
      });
      setFeatures({
        follow_up: true,
        ai_variations: false,
        multi_conexao: true,
        campanhas_interativas: true,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating plano:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Plano</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="nome">Nome do Plano</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="preco">Preço Mensal (R$)</Label>
              <Input
                id="preco"
                type="number"
                step="0.01"
                value={formData.preco_mensal}
                onChange={(e) => setFormData({ ...formData, preco_mensal: parseFloat(e.target.value) })}
                required
              />
            </div>

            <div>
              <Label htmlFor="disparos">Disparos/Mês</Label>
              <Input
                id="disparos"
                type="number"
                value={formData.limite_disparos_mensal}
                onChange={(e) => setFormData({ ...formData, limite_disparos_mensal: parseInt(e.target.value) })}
                required
              />
            </div>

            <div>
              <Label htmlFor="conexoes">Conexões</Label>
              <Input
                id="conexoes"
                type="number"
                value={formData.limite_conexoes}
                onChange={(e) => setFormData({ ...formData, limite_conexoes: parseInt(e.target.value) })}
                required
              />
            </div>

            <div>
              <Label htmlFor="contatos">Contatos</Label>
              <Input
                id="contatos"
                type="number"
                value={formData.limite_contatos}
                onChange={(e) => setFormData({ ...formData, limite_contatos: parseInt(e.target.value) })}
                required
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="campanhas">Campanhas Simultâneas</Label>
              <Input
                id="campanhas"
                type="number"
                value={formData.limite_campanhas_simultaneas}
                onChange={(e) => setFormData({ ...formData, limite_campanhas_simultaneas: parseInt(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Features Habilitadas</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={features.follow_up}
                  onCheckedChange={(checked) => setFeatures({ ...features, follow_up: !!checked })}
                />
                <Label className="font-normal">Follow-up</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={features.ai_variations}
                  onCheckedChange={(checked) => setFeatures({ ...features, ai_variations: !!checked })}
                />
                <Label className="font-normal">Variações com IA</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={features.multi_conexao}
                  onCheckedChange={(checked) => setFeatures({ ...features, multi_conexao: !!checked })}
                />
                <Label className="font-normal">Múltiplas Conexões</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={features.campanhas_interativas}
                  onCheckedChange={(checked) => setFeatures({ ...features, campanhas_interativas: !!checked })}
                />
                <Label className="font-normal">Campanhas Interativas</Label>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={createPlano.isPending} className="flex-1">
              {createPlano.isPending ? "Criando..." : "Criar Plano"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
