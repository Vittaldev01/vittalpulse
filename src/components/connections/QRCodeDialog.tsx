import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, QrCode, AlertCircle } from "lucide-react";

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCode: string | null;
  connectionName: string;
  lastError?: string | null;
}

export const QRCodeDialog = ({ open, onOpenChange, qrCode, connectionName, lastError }: QRCodeDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Conectar {connectionName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Escaneie o QR Code abaixo com seu WhatsApp para conectar
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {qrCode ? (
            <>
              <div className="rounded-lg border-2 border-border p-4 bg-background">
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64 object-contain"
                />
              </div>
              <Alert className="bg-muted border-border">
                <AlertDescription className="text-sm text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Abra o WhatsApp no seu celular</li>
                    <li>Toque em <strong>Mais opções</strong> ou <strong>Configurações</strong></li>
                    <li>Toque em <strong>Aparelhos conectados</strong></li>
                    <li>Toque em <strong>Conectar um aparelho</strong></li>
                    <li>Aponte seu celular para esta tela para escanear o código</li>
                  </ol>
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8 w-full">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Gerando QR Code...</p>
              {lastError && (
                <Alert className="bg-destructive/10 border-destructive/20 w-full">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-sm text-destructive ml-2">
                    {lastError}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
