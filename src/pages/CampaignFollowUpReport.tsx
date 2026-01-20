import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FollowUpStatusTable } from "@/components/campaigns/FollowUpStatusTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFollowUpStatus } from "@/hooks/useFollowUpStatus";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function CampaignFollowUpReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { followUpContacts, isLoading, initializeFollowUpStatus } = useFollowUpStatus(id || "");

  // Buscar informações da campanha (tipo e nome)
  const { data: campaign } = useQuery({
    queryKey: ["campaign-info", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("campaigns")
        .select("campaign_type, name")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erro ao buscar campanha:", error);
        return null;
      }

      return data;
    },
    enabled: !!id,
  });

  // Verificar se existe follow-up flow configurado
  const { data: hasFlow } = useQuery({
    queryKey: ["follow-up-flow-exists", id],
    queryFn: async () => {
      if (!id) return false;
      
      const { data, error } = await supabase
        .from("follow_up_flows")
        .select("id, is_active")
        .eq("campaign_id", id)
        .maybeSingle();

      if (error) {
        console.error("Erro ao verificar flow:", error);
        return false;
      }

      return data?.is_active || false;
    },
    enabled: !!id,
  });

  if (!id) {
    return null;
  }

  const showInitializeButton = hasFlow && !isLoading && followUpContacts.length === 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/campaigns/${id}`)}
          className="hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Relatório de Follow-up
            {campaign?.campaign_type === 'interactive' && (
              <span className="ml-3 text-sm font-normal text-primary bg-primary/10 px-3 py-1 rounded-full">
                Campanha Interativa
              </span>
            )}
          </h1>
          <p className="text-muted-foreground">
            {campaign?.campaign_type === 'interactive' 
              ? "Contatos que não responderam às mensagens iniciais entraram automaticamente no fluxo de follow-up"
              : "Acompanhe o status e progresso de cada contato no fluxo de follow-up"
            }
          </p>
        </div>
      </div>

      {showInitializeButton && (
        <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertTitle className="text-yellow-900 dark:text-yellow-100">
            Follow-up Detectado mas Não Inicializado
          </AlertTitle>
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm">
                Esta campanha tem follow-up configurado, mas os registros não foram criados.
                Isso pode acontecer devido a um problema de sincronização. Clique no botão para corrigir.
              </p>
              <Button
                onClick={() => initializeFollowUpStatus.mutate(id)}
                disabled={initializeFollowUpStatus.isPending}
                className="ml-4 shrink-0"
              >
                {initializeFollowUpStatus.isPending ? "Inicializando..." : "Inicializar Follow-ups"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Status dos Contatos</CardTitle>
          <CardDescription className="text-muted-foreground">
            Visualize a etapa atual, próximo envio e respostas de cada contato. 
            Você pode editar a data do próximo envio individualmente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FollowUpStatusTable campaignId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
