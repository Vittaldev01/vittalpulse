import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AIGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVariationsGenerated: (variations: string[]) => void;
}

export function AIGenerationDialog({ open, onOpenChange, onVariationsGenerated }: AIGenerationDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt obrigatório",
        description: "Digite uma mensagem base para gerar as variações.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-variations', {
        body: { prompt: prompt.trim(), count: 7 }
      });

      if (error) throw error;

      if (data?.variations && data.variations.length > 0) {
        onVariationsGenerated(data.variations);
        toast({
          title: "✨ Variações geradas!",
          description: `${data.variations.length} variações criadas com sucesso.`,
        });
        onOpenChange(false);
        setPrompt("");
      } else {
        throw new Error('Nenhuma variação foi gerada');
      }

    } catch (error: any) {
      console.error('Erro ao gerar variações:', error);
      toast({
        title: "Erro ao gerar variações",
        description: error.message || "Ocorreu um erro ao gerar as variações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar Variações com IA
          </DialogTitle>
          <DialogDescription>
            Digite uma mensagem base e a IA criará até 7 variações diferentes e persuasivas para você.
            Use variáveis como {`{{nome}}`} e {`{{telefone}}`} para personalizar as mensagens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Mensagem Base</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Olá {{nome}}! Temos uma oferta especial para você..."
              className="min-h-[120px]"
              disabled={isGenerating}
            />
          </div>

          <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
            <p className="font-medium mb-1">💡 Dica:</p>
            <p>Quanto mais clara e específica for sua mensagem, melhores serão as variações geradas.</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar Variações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
