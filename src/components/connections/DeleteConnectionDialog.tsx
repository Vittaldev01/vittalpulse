import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, XCircle, Loader2, Smartphone, Circle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface ConnectionInfo {
  id: string;
  name: string;
}

interface AvailableConnection {
  id: string;
  name: string;
  phone_number: string | null;
  status: string;
}

interface DeleteConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionName: string;
  onConfirm: (targetConnectionId: string | null) => Promise<void>;
  warnings?: {
    activeCampaigns: Campaign[];
    activeFollowUps: number;
    riskMessage: string | null;
  };
  impact?: {
    contactsToTransfer: number;
    messagesInHistory: number;
    newConnection?: ConnectionInfo | null;
  };
  availableConnections?: AvailableConnection[];
  blocked?: boolean;
  blockReason?: string;
  loading?: boolean;
}

const getStatusBadge = (status: string) => {
  const variants: Record<string, { className: string; text: string }> = {
    connected: { className: "bg-green-500 text-white", text: "Conectado" },
    pending: { className: "bg-yellow-500 text-black", text: "Pendente" },
    disconnected: { className: "bg-red-500 text-white", text: "Desconectado" },
  };
  
  const config = variants[status] || variants.disconnected;
  
  return (
    <Badge className={config.className} variant="secondary">
      {config.text}
    </Badge>
  );
};

export function DeleteConnectionDialog({
  open,
  onOpenChange,
  connectionName,
  onConfirm,
  warnings,
  impact,
  availableConnections = [],
  blocked,
  blockReason,
  loading,
}: DeleteConnectionDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);

  // Pré-selecionar o primeiro chip disponível ao abrir
  useEffect(() => {
    if (open && availableConnections.length > 0 && !selectedChipId) {
      // Priorizar chips conectados
      const connected = availableConnections.find(c => c.status === "connected");
      setSelectedChipId(connected?.id || availableConnections[0]?.id || null);
    }
    if (!open) {
      setSelectedChipId(null);
    }
  }, [open, availableConnections]);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm(selectedChipId);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  const hasWarnings = warnings && (warnings.activeCampaigns.length > 0 || warnings.activeFollowUps > 0);
  const hasContacts = (impact?.contactsToTransfer || 0) > 0;

  // Componente ChipSelector
  const ChipSelector = () => {
    if (!hasContacts) return null;

    return (
      <div className="space-y-3 border-t pt-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Transferir {impact?.contactsToTransfer} contato{impact?.contactsToTransfer !== 1 ? 's' : ''} para:
        </h4>
        
        <RadioGroup 
          value={selectedChipId || "none"} 
          onValueChange={(val) => setSelectedChipId(val === "none" ? null : val)}
          className="space-y-2"
        >
          {availableConnections.map((conn) => (
            <div 
              key={conn.id}
              className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <RadioGroupItem value={conn.id} id={conn.id} />
              <Label htmlFor={conn.id} className="flex-1 flex items-center justify-between cursor-pointer">
                <div>
                  <span className="font-medium">{conn.name}</span>
                  {conn.phone_number && (
                    <span className="text-sm text-muted-foreground ml-2">
                      {conn.phone_number}
                    </span>
                  )}
                </div>
                {getStatusBadge(conn.status)}
              </Label>
            </div>
          ))}
          
          {/* Opção de não vincular */}
          <div 
            className="flex items-center space-x-3 p-3 rounded-lg border border-dashed hover:bg-muted/50 transition-colors"
          >
            <RadioGroupItem value="none" id="none" />
            <Label htmlFor="none" className="flex-1 flex items-center gap-2 cursor-pointer text-muted-foreground">
              <Circle className="h-4 w-4" />
              <span>Não vincular a nenhum chip</span>
            </Label>
          </div>
        </RadioGroup>
      </div>
    );
  };

  // Estado: Loading
  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>🗑️ Excluir conexão "{connectionName}"?</DialogTitle>
            <DialogDescription>Analisando conexão...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Estado: Bloqueado (sem chip alternativo) - OBSOLETO, agora permite escolher "nenhum"
  // Mantido apenas para compatibilidade
  if (blocked && blockReason === 'no_alternative_chip') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Excluir "{connectionName}"?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Não há outro chip disponível. Os {impact?.contactsToTransfer || 0} contatos ficarão sem vínculo.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Estado: Com avisos (campanhas ativas)
  if (hasWarnings) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Excluir conexão "{connectionName}"?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="ml-2">
                <strong>ATENÇÃO:</strong> Esta conexão está em uso
              </AlertDescription>
            </Alert>

            {warnings.activeCampaigns.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  📢 Campanhas Ativas:
                </h4>
                <ul className="space-y-1 ml-4">
                  {warnings.activeCampaigns.map((campaign) => (
                    <li key={campaign.id} className="text-sm text-muted-foreground">
                      • "{campaign.name}" ({campaign.status === 'running' ? 'em execução' : campaign.status === 'paused' ? 'pausada' : 'agendada'})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {warnings.activeFollowUps > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  🔄 Follow-ups Ativos: {warnings.activeFollowUps} leads
                </h4>
              </div>
            )}

            {warnings.riskMessage && (
              <Alert>
                <AlertDescription className="text-sm">
                  ⚠️ <strong>Risco:</strong> {warnings.riskMessage}
                </AlertDescription>
              </Alert>
            )}

            <ChipSelector />

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-semibold">Esta ação irá:</h4>
              
              {hasContacts && (
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>
                    {selectedChipId ? (
                      <>Transferir <strong>{impact?.contactsToTransfer}</strong> contato{impact?.contactsToTransfer !== 1 ? 's' : ''} para o chip selecionado</>
                    ) : (
                      <>Desvincular <strong>{impact?.contactsToTransfer}</strong> contato{impact?.contactsToTransfer !== 1 ? 's' : ''}</>
                    )}
                  </span>
                </div>
              )}

              {impact?.messagesInHistory && impact.messagesInHistory > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>
                    Preservar histórico de <strong>{impact.messagesInHistory}</strong> mensagem{impact.messagesInHistory !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir mesmo assim"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Estado: Sem avisos (nenhuma campanha ativa)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🗑️ Excluir conexão "{connectionName}"?</DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="ml-2">
              Nenhuma campanha ativa usando esta conexão
            </AlertDescription>
          </Alert>

          <ChipSelector />

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Esta ação irá:</h4>

            {hasContacts && (
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>
                  {selectedChipId ? (
                    <>Transferir <strong>{impact?.contactsToTransfer}</strong> contato{impact?.contactsToTransfer !== 1 ? 's' : ''} para o chip selecionado</>
                  ) : (
                    <>Desvincular <strong>{impact?.contactsToTransfer}</strong> contato{impact?.contactsToTransfer !== 1 ? 's' : ''}</>
                  )}
                </span>
              </div>
            )}

            {impact?.messagesInHistory && impact.messagesInHistory > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>
                  Preservar histórico de <strong>{impact.messagesInHistory}</strong> mensagem{impact.messagesInHistory !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              "Excluir"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
