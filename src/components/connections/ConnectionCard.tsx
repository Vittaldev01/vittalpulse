import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, RefreshCw, QrCode, Settings, AlertCircle, Key, Webhook, Copy, CheckCheck } from "lucide-react";
import type { WhatsAppConnection, DeletePreviewResult } from "@/hooks/useConnections";
import { QRCodeDialog } from "./QRCodeDialog";
import { PairingCodeDialog } from "./PairingCodeDialog";
import { DeleteConnectionDialog } from "./DeleteConnectionDialog";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ConnectionCardProps {
  connection: WhatsAppConnection;
  onPreviewDelete: () => Promise<DeletePreviewResult>;
  onConfirmDelete: (targetConnectionId: string | null) => Promise<void>;
  onReconnect: () => void;
  onGeneratePairingCode: (phone: string) => void;
  onCheckStatus: () => void;
}

const getStatusBadge = (status: string) => {
  const variants = {
    connected: { variant: "default" as const, text: "Conectado", className: "bg-primary text-primary-foreground" },
    disconnected: { variant: "destructive" as const, text: "Desconectado", className: "" },
    pending: { variant: "secondary" as const, text: "Pendente", className: "bg-yellow-500 text-black" },
  };
  
  const config = variants[status as keyof typeof variants] || variants.pending;
  
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.text}
    </Badge>
  );
};

export const ConnectionCard = ({ 
  connection, 
  onPreviewDelete, 
  onConfirmDelete, 
  onReconnect, 
  onGeneratePairingCode, 
  onCheckStatus 
}: ConnectionCardProps) => {
  const [showQRCode, setShowQRCode] = useState(false);
  const [showPairingDialog, setShowPairingDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteDialogData, setDeleteDialogData] = useState<DeletePreviewResult | null>(null);
  const [isLoadingDeleteInfo, setIsLoadingDeleteInfo] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [qrPreference, setQrPreference] = useState(connection.qr_endpoint_preference || "auto");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [isConfiguringWebhook, setIsConfiguringWebhook] = useState(false);
  const [showWebhookInfo, setShowWebhookInfo] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDeleteClick = async () => {
    setIsLoadingDeleteInfo(true);
    setShowDeleteDialog(true);
    setDeleteDialogData(null);
    
    try {
      const data = await onPreviewDelete();
      setDeleteDialogData(data);
    } catch (error) {
      console.error('Erro ao obter informações de exclusão:', error);
      toast({
        title: "Erro",
        description: "Não foi possível obter informações sobre a exclusão.",
        variant: "destructive",
      });
      setShowDeleteDialog(false);
    } finally {
      setIsLoadingDeleteInfo(false);
    }
  };

  const handleConfirmDelete = async (targetConnectionId: string | null) => {
    await onConfirmDelete(targetConnectionId);
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-handler`;

  const handlePreferenceChange = async (value: string) => {
    setQrPreference(value);
    
    try {
      const { error } = await supabase
        .from("whatsapp_connections")
        .update({ qr_endpoint_preference: value })
        .eq("id", connection.id);

      if (error) throw error;

      toast({
        title: "Preferência atualizada",
        description: "A preferência de QR foi salva com sucesso.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["whatsapp_connections"] });
    } catch (error) {
      console.error("Erro ao atualizar preferência:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar a preferência.",
        variant: "destructive",
      });
    }
  };

  const handleApplyAndGenerateQR = async () => {
    setIsReconnecting(true);
    setShowQRCode(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("reconnect-whatsapp-connection", {
        body: { connectionId: connection.id },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "QR Code regenerado",
          description: data.message || "Escaneie o QR Code para reconectar.",
        });
        queryClient.invalidateQueries({ queryKey: ["whatsapp_connections"] });
      } else {
        throw new Error(data?.error || "Erro ao regenerar QR Code");
      }
    } catch (error) {
      console.error("Erro ao gerar QR:", error);
      toast({
        title: "Erro ao gerar QR",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
      setShowQRCode(false);
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleReconnect = () => {
    onReconnect();
    setShowQRCode(true);
  };

  const handleViewQRCode = async () => {
    setShowQRCode(true);
    // Buscar o QR code da instância
    onCheckStatus();
  };

  const handleGeneratePairingCode = () => {
    if (!phoneNumber) {
      setShowPhoneInput(true);
      return;
    }
    onGeneratePairingCode(phoneNumber);
    setShowPairingDialog(true);
    setShowPhoneInput(false);
  };

  const handleConfigureWebhook = async () => {
    setIsConfiguringWebhook(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("configure-webhook", {
        body: { connectionId: connection.id },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: data.webhookConfigured ? "Webhook configurado!" : "URL do Webhook",
          description: data.message,
          variant: data.webhookConfigured ? "default" : "default",
        });
        
        if (!data.webhookConfigured) {
          setShowWebhookInfo(true);
        }
      } else {
        throw new Error(data?.error || "Erro ao configurar webhook");
      }
    } catch (error: any) {
      console.error("Erro ao configurar webhook:", error);
      
      // Se a conexão não foi encontrada, pode ser dado desatualizado
      if (error?.message?.includes("não encontrada") || error?.message?.includes("not found")) {
        toast({
          title: "Conexão não encontrada",
          description: "Esta conexão pode ter sido deletada. Atualizando lista...",
          variant: "destructive",
        });
        // Invalidar e recarregar a lista de conexões
        queryClient.invalidateQueries({ queryKey: ["whatsapp_connections"] });
      } else {
        toast({
          title: "Configuração manual necessária",
          description: "Configure o webhook manualmente no painel UAZAPI com a URL mostrada.",
        });
        setShowWebhookInfo(true);
      }
    } finally {
      setIsConfiguringWebhook(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast({
      title: "URL copiada!",
      description: "Cole esta URL no painel UAZAPI.",
    });
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <>
      <Card className="border-border bg-card hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-foreground">{connection.name}</CardTitle>
              <CardDescription>
                {connection.phone_number || "Aguardando conexão"}
              </CardDescription>
            </div>
            {getStatusBadge(connection.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {connection.last_error && connection.status !== "connected" && (
              <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-xs text-destructive">{connection.last_error}</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {connection.connected_at ? (
                  <span>Conectado em {new Date(connection.connected_at).toLocaleDateString()}</span>
                ) : (
                  <span>Criado em {new Date(connection.created_at).toLocaleDateString()}</span>
                )}
              </div>
            <div className="flex gap-2 flex-wrap">
              {connection.status === "pending" && (
                <>
                  <div className="w-full mb-2 p-2 bg-muted rounded text-xs text-center text-muted-foreground">
                    💡 Aguarde 10-15 segundos após criar antes de ver o QR Code
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleViewQRCode}
                    className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <QrCode className="h-4 w-4 mr-1" />
                    Ver QR Code
                  </Button>
                  {!showPhoneInput ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowPhoneInput(true)}
                      className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      <Key className="h-4 w-4 mr-1" />
                      Código
                    </Button>
                  ) : (
                    <div className="flex gap-2 items-end w-full">
                      <div className="flex-1 min-w-[150px]">
                        <Label htmlFor="phone" className="text-xs">Telefone (com DDI)</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="5511999999999"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <Button size="sm" onClick={handleGeneratePairingCode}>
                        Gerar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setShowPhoneInput(false);
                        setPhoneNumber("");
                      }}>
                        Cancelar
                      </Button>
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onCheckStatus}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Atualizar
                  </Button>
                </>
              )}
              {connection.status === "disconnected" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReconnect}
                    disabled={isReconnecting}
                    className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${isReconnecting ? "animate-spin" : ""}`} />
                    Reconectar
                  </Button>
                  {!showPhoneInput ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowPhoneInput(true)}
                      className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      <Key className="h-4 w-4 mr-1" />
                      Código
                    </Button>
                  ) : (
                    <div className="flex gap-2 items-end w-full">
                      <div className="flex-1 min-w-[150px]">
                        <Label htmlFor="phone" className="text-xs">Telefone (com DDI)</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="5511999999999"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <Button size="sm" onClick={handleGeneratePairingCode}>
                        Gerar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setShowPhoneInput(false);
                        setPhoneNumber("");
                      }}>
                        Cancelar
                      </Button>
                    </div>
                  )}
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleConfigureWebhook}
                disabled={isConfiguringWebhook}
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                title="Configurar Webhook para capturar respostas"
              >
                <Webhook className={`h-4 w-4 mr-1 ${isConfiguringWebhook ? "animate-spin" : ""}`} />
                Webhook
              </Button>
              <Popover open={showSettings} onOpenChange={setShowSettings}>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Preferência de QR Code</h4>
                      <Select value={qrPreference} onValueChange={handlePreferenceChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto (testar todos)</SelectItem>
                          <SelectItem value="exportQrcodeBase64_get">exportQrcodeBase64 (GET)</SelectItem>
                          <SelectItem value="exportQrcodeBase64_post">exportQrcodeBase64 (POST)</SelectItem>
                          <SelectItem value="instance_id_qrcode">instance/{'{id}'}/qrcode</SelectItem>
                          <SelectItem value="instance_qrcode_id">instance/qrcode/{'{id}'}</SelectItem>
                          <SelectItem value="qrcode_id">qrcode/{'{id}'}</SelectItem>
                          <SelectItem value="qr_id">qr/{'{id}'}</SelectItem>
                          <SelectItem value="instance_qr_id">instance/qr/{'{id}'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={handleApplyAndGenerateQR} 
                      disabled={isReconnecting}
                      className="w-full"
                    >
                      {isReconnecting ? "Gerando..." : "Aplicar e Gerar QR"}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDeleteClick}
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {showWebhookInfo && (
        <Card className="border-primary bg-primary/5 mt-2">
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-sm mb-1">Configure o Webhook no Painel UAZAPI</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Para capturar respostas dos leads, adicione esta URL no painel UAZAPI:
                  </p>
                  <div className="flex items-center gap-2 bg-background p-2 rounded border">
                    <code className="text-xs flex-1 break-all">{webhookUrl}</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={copyWebhookUrl}
                      className="h-7 w-7 p-0"
                    >
                      {copiedWebhook ? (
                        <CheckCheck className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Configure o evento: <strong>messages</strong>
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowWebhookInfo(false)}
                className="w-full"
              >
                Entendido
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <QRCodeDialog
        open={showQRCode}
        onOpenChange={setShowQRCode}
        qrCode={connection.qr_code}
        connectionName={connection.name}
        lastError={connection.last_error}
      />
      <PairingCodeDialog
        open={showPairingDialog}
        onOpenChange={setShowPairingDialog}
        pairingCode={connection.pairing_code}
        expiresAt={connection.pairing_code_expires_at}
        connectionName={connection.name}
        lastError={connection.last_error}
      />
      <DeleteConnectionDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        connectionName={connection.name}
        onConfirm={handleConfirmDelete}
        warnings={deleteDialogData?.warnings}
        impact={deleteDialogData?.impact}
        availableConnections={deleteDialogData?.availableConnections}
        loading={isLoadingDeleteInfo}
      />
    </>
  );
};
