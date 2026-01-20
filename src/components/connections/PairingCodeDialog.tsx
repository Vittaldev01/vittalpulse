import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface PairingCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pairingCode: string | null;
  expiresAt: string | null;
  connectionName: string;
  lastError?: string | null;
}

export const PairingCodeDialog = ({ 
  open, 
  onOpenChange, 
  pairingCode, 
  expiresAt,
  connectionName, 
  lastError 
}: PairingCodeDialogProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    if (pairingCode) {
      navigator.clipboard.writeText(pairingCode);
      setCopied(true);
      toast({
        title: "Copiado!",
        description: "Código de pareamento copiado para a área de transferência.",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            Código de Pareamento - {connectionName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Use este código no WhatsApp para conectar
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {pairingCode ? (
            <>
              <div className="w-full rounded-lg border-2 border-border p-6 bg-background flex flex-col items-center gap-4">
                <div className="text-4xl font-mono font-bold text-primary tracking-widest">
                  {pairingCode}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar Código
                    </>
                  )}
                </Button>
              </div>
              <Alert className="bg-muted border-border">
                <AlertDescription className="text-sm text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Abra o WhatsApp no seu celular</li>
                    <li>Toque em <strong>Mais opções</strong> ou <strong>Configurações</strong></li>
                    <li>Toque em <strong>Aparelhos conectados</strong></li>
                    <li>Toque em <strong>Conectar um aparelho</strong></li>
                    <li>Escolha <strong>Conectar com número de telefone</strong></li>
                    <li>Digite o código: <strong>{pairingCode}</strong></li>
                  </ol>
                  {expiresAt && (
                    <p className="mt-2 text-destructive font-medium">
                      Código expira em 5 minutos
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8 w-full">
              {lastError ? (
                <Alert className="bg-destructive/10 border-destructive/20 w-full">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-sm text-destructive ml-2">
                    {lastError}
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-muted-foreground">Gerando código de pareamento...</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
