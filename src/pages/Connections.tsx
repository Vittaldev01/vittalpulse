import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConnections } from "@/hooks/useConnections";
import { ConnectionCard } from "@/components/connections/ConnectionCard";
import { NewConnectionDialog } from "@/components/connections/NewConnectionDialog";
import { SyncUazapiDialog } from "@/components/connections/SyncUazapiDialog";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Connections() {
  const navigate = useNavigate();
  const { 
    connections, 
    isLoading, 
    createConnection, 
    previewDeleteConnection, 
    deleteConnectionSafe, 
    generatePairingCode, 
    checkConnectionStatus, 
    syncAllStatus 
  } = useConnections();
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  const handleCreateConnection = (name: string) => {
    createConnection.mutate(name);
  };

  const handlePreviewDelete = async (connectionId: string) => {
    return await previewDeleteConnection.mutateAsync(connectionId);
  };

  const handleConfirmDelete = async (connectionId: string, targetConnectionId: string | null) => {
    await deleteConnectionSafe.mutateAsync({ connectionId, targetConnectionId });
  };

  const handleGeneratePairingCode = (connection: any, phone: string) => {
    generatePairingCode.mutate({ connectionId: connection.id, phone });
  };

  const handleCheckStatus = (connection: any) => {
    checkConnectionStatus.mutate(connection.id);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Conexões WhatsApp</h1>
          <p className="text-muted-foreground">Gerencie suas conexões de WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => syncAllStatus.mutate()}
            disabled={syncAllStatus.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncAllStatus.isPending ? 'animate-spin' : ''}`} />
            {syncAllStatus.isPending ? 'Sincronizando...' : 'Sincronizar Status'}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/connection-health")}
          >
            <Activity className="h-4 w-4 mr-2" />
            Ver Saúde das Conexões
          </Button>
          <NewConnectionDialog
            onCreateConnection={handleCreateConnection}
            isLoading={createConnection.isPending}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : connections.length === 0 ? (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Suas Conexões</CardTitle>
            <CardDescription>Nenhuma conexão configurada ainda</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Comece conectando seu primeiro WhatsApp para enviar mensagens automatizadas
              </p>
              <NewConnectionDialog
                onCreateConnection={handleCreateConnection}
                isLoading={createConnection.isPending}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              onPreviewDelete={() => handlePreviewDelete(connection.id)}
              onConfirmDelete={(targetConnectionId) => handleConfirmDelete(connection.id, targetConnectionId)}
              onReconnect={() => checkConnectionStatus.mutate(connection.id)}
              onGeneratePairingCode={(phone) => handleGeneratePairingCode(connection, phone)}
              onCheckStatus={() => handleCheckStatus(connection)}
            />
          ))}
        </div>
      )}

      <SyncUazapiDialog
        open={showSyncDialog}
        onOpenChange={setShowSyncDialog}
      />
    </div>
  );
}
