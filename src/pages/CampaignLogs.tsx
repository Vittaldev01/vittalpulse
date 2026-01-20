import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LogMessage {
  id: string;
  timestamp: string;
  type: "sent" | "failed" | "webhook";
  contact_name: string;
  contact_phone: string;
  message: string;
  error?: string;
  webhook_data?: any;
}

export default function CampaignLogs() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [campaign, setCampaign] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
    if (!id) return;

    // Buscar campanha
    const { data: campaignData } = await supabase
      .from("campaigns")
      .select("*, whatsapp_connections(id)")
      .eq("id", id)
      .single();

    setCampaign(campaignData);

    // Buscar mensagens
    const { data: messages } = await supabase
      .from("campaign_messages")
      .select("*, contacts(name, phone)")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false });

    // Buscar webhooks
    const { data: webhooks } = await supabase
      .from("webhooks_log")
      .select("*")
      .eq("connection_id", campaignData?.whatsapp_connections?.id)
      .order("created_at", { ascending: false })
      .limit(50);

    // Combinar e ordenar logs
    const combinedLogs: LogMessage[] = [
      ...(messages?.map((msg: any) => ({
        id: msg.id,
        timestamp: msg.sent_at || msg.created_at,
        type: (msg.status === "sent" ? "sent" : "failed") as "sent" | "failed",
        contact_name: msg.contacts.name,
        contact_phone: msg.contacts.phone,
        message: msg.message_text,
        error: msg.error_message,
      })) || []),
      ...(webhooks?.map((wh: any) => ({
        id: wh.id,
        timestamp: wh.created_at,
        type: "webhook" as "webhook",
        contact_name: "",
        contact_phone: "",
        message: wh.event_type,
        webhook_data: wh.payload,
      })) || []),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setLogs(combinedLogs);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [id]);

  // Realtime updates
  useEffect(() => {
    if (!id || !autoRefresh) return;

    const channel = supabase
      .channel(`campaign-logs-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_messages",
          filter: `campaign_id=eq.${id}`,
        },
        () => {
          fetchLogs();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "webhooks_log",
        },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, autoRefresh]);

  const sentLogs = logs.filter((l) => l.type === "sent");
  const failedLogs = logs.filter((l) => l.type === "failed");
  const webhookLogs = logs.filter((l) => l.type === "webhook");

  const LogItem = ({ log }: { log: LogMessage }) => (
    <div className="border-b border-border last:border-0 py-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {log.type === "sent" && (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
          {log.type === "failed" && (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
          {log.type === "webhook" && (
            <Clock className="h-4 w-4 text-blue-500" />
          )}
          <span className="font-medium text-foreground">
            {log.contact_name || "Webhook"}
          </span>
          {log.contact_phone && (
            <Badge variant="outline">{log.contact_phone}</Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(log.timestamp).toLocaleString("pt-BR")}
        </span>
      </div>
      
      <p className="text-sm text-muted-foreground mb-2">{log.message}</p>
      
      {log.error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded p-2 mt-2">
          <p className="text-xs text-destructive font-mono">{log.error}</p>
        </div>
      )}
      
      {log.webhook_data && (
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            Ver dados completos
          </summary>
          <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
            {JSON.stringify(log.webhook_data, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/campaigns/${id}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Logs da Campanha</h1>
            <p className="text-muted-foreground">{campaign?.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enviadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{sentLogs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Falhas</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{failedLogs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webhooks</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{webhookLogs.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico Detalhado</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">
                Todos ({logs.length})
              </TabsTrigger>
              <TabsTrigger value="sent">
                Enviadas ({sentLogs.length})
              </TabsTrigger>
              <TabsTrigger value="failed">
                Falhas ({failedLogs.length})
              </TabsTrigger>
              <TabsTrigger value="webhooks">
                Webhooks ({webhookLogs.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <ScrollArea className="h-[600px] pr-4">
                {logs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum log encontrado
                  </p>
                ) : (
                  logs.map((log) => <LogItem key={log.id} log={log} />)
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="sent">
              <ScrollArea className="h-[600px] pr-4">
                {sentLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma mensagem enviada
                  </p>
                ) : (
                  sentLogs.map((log) => <LogItem key={log.id} log={log} />)
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="failed">
              <ScrollArea className="h-[600px] pr-4">
                {failedLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma falha registrada
                  </p>
                ) : (
                  failedLogs.map((log) => <LogItem key={log.id} log={log} />)
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="webhooks">
              <ScrollArea className="h-[600px] pr-4">
                {webhookLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum webhook recebido
                  </p>
                ) : (
                  webhookLogs.map((log) => <LogItem key={log.id} log={log} />)
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
