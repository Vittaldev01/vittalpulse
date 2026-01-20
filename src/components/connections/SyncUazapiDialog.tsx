import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSyncUazapi } from "@/hooks/useSyncUazapi";
import { Download, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SyncUazapiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SyncUazapiDialog({ open, onOpenChange }: SyncUazapiDialogProps) {
  const { instances, isLoading, isFetching, fetchInstances, importInstance } = useSyncUazapi();
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set());

  const handleFetchInstances = () => {
    setSelectedInstances(new Set());
    fetchInstances();
  };

  const toggleInstance = (instanceId: string) => {
    const newSelected = new Set(selectedInstances);
    if (newSelected.has(instanceId)) {
      newSelected.delete(instanceId);
    } else {
      newSelected.add(instanceId);
    }
    setSelectedInstances(newSelected);
  };

  const handleImportSelected = async () => {
    const instancesToImport = instances.filter(i => 
      selectedInstances.has(i.id) && !i.isImported
    );

    for (const instance of instancesToImport) {
      await importInstance.mutateAsync({
        instanceId: instance.id,
        instanceToken: instance.token,
        instanceName: instance.name,
      });
    }

    setSelectedInstances(new Set());
    onOpenChange(false);
  };

  const availableToImport = instances.filter(i => !i.isImported).length;
  const selectedCount = Array.from(selectedInstances).filter(id => 
    instances.find(i => i.id === id && !i.isImported)
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sincronizar Instâncias UAZAPI</DialogTitle>
          <DialogDescription>
            Importe instâncias que já existem no painel UAZAPI para o Lovable
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              onClick={handleFetchInstances}
              disabled={isFetching}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Buscando...' : 'Buscar Instâncias'}
            </Button>

            {instances.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {availableToImport} disponível{availableToImport !== 1 ? 'is' : ''} para importar
              </div>
            )}
          </div>

          {isLoading || isFetching ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : instances.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Clique em "Buscar Instâncias" para ver as instâncias disponíveis no UAZAPI
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px] rounded-md border p-4">
                <div className="space-y-2">
                  {instances.map((instance) => (
                    <div
                      key={instance.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        instance.isImported
                          ? 'bg-muted/50 border-muted cursor-not-allowed'
                          : selectedInstances.has(instance.id)
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-accent cursor-pointer'
                      }`}
                      onClick={() => !instance.isImported && toggleInstance(instance.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{instance.name}</span>
                          {instance.isImported ? (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Já importado
                            </Badge>
                          ) : (
                            <Badge 
                              variant={instance.status === 'open' ? 'default' : 'outline'}
                            >
                              {instance.status === 'open' ? 'Conectado' : 'Desconectado'}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          ID: {instance.id}
                          {instance.phone && ` • ${instance.phone}`}
                        </div>
                      </div>

                      {!instance.isImported && (
                        <div>
                          {selectedInstances.has(instance.id) ? (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {selectedCount > 0 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    {selectedCount} instância{selectedCount !== 1 ? 's' : ''} selecionada{selectedCount !== 1 ? 's' : ''}
                  </span>
                  <Button
                    onClick={handleImportSelected}
                    disabled={importInstance.isPending}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {importInstance.isPending ? 'Importando...' : 'Importar Selecionadas'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
