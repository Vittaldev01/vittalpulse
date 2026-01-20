import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Webhook, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface LogMessage {
  type: "sent" | "failed" | "webhook";
  timestamp: string;
  contact_name?: string;
  contact_phone?: string;
  message?: string;
  error?: string;
  webhook_data?: any;
  campaign_name?: string;
}

export default function Logs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (user) {
      fetchCampaigns();
      fetchLogs();
    }
  }, [user, selectedCampaign, statusFilter]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, selectedCampaign, statusFilter]);

  const fetchCampaigns = async () => {
    const { data } = await supabase
      .from("campaigns")
      .select("id, name")
      .order("created_at", { ascending: false });
    
    if (data) setCampaigns(data);
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    
    const allLogs: LogMessage[] = [];

    // Buscar mensagens enviadas
    let sentQuery = supabase
      .from("campaign_messages")
      .select(`
        sent_at,
        message_text,
        status,
        error_message,
        contacts (name, phone),
        campaigns (name)
      `)
      .order("sent_at", { ascending: false })
      .limit(100);

    if (selectedCampaign !== "all") {
      sentQuery = sentQuery.eq("campaign_id", selectedCampaign);
    }

    const { data: sentMessages } = await sentQuery;

    if (sentMessages) {
      sentMessages.forEach((msg: any) => {
        if (msg.status === "sent" && (statusFilter === "all" || statusFilter === "sent")) {
          allLogs.push({
            type: "sent",
            timestamp: msg.sent_at,
            contact_name: msg.contacts?.name,
            contact_phone: msg.contacts?.phone,
            message: msg.message_text,
            campaign_name: msg.campaigns?.name,
          });
        } else if (msg.status === "failed" && (statusFilter === "all" || statusFilter === "failed")) {
          allLogs.push({
            type: "failed",
            timestamp: msg.sent_at,
            contact_name: msg.contacts?.name,
            contact_phone: msg.contacts?.phone,
            message: msg.message_text,
            error: msg.error_message,
            campaign_name: msg.campaigns?.name,
          });
        }
      });
    }

    // Buscar webhooks
    if (statusFilter === "all" || statusFilter === "webhook") {
      let webhookQuery = supabase
        .from("webhooks_log")
        .select(`
          created_at,
          event_type,
          payload,
          whatsapp_connections (
            campaigns (name)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      const { data: webhooks } = await webhookQuery;

      if (webhooks) {
        webhooks.forEach((webhook: any) => {
          allLogs.push({
            type: "webhook",
            timestamp: webhook.created_at,
            webhook_data: webhook.payload,
            campaign_name: webhook.whatsapp_connections?.campaigns?.[0]?.name,
          });
        });
      }
    }

    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setLogs(allLogs);
    setIsLoading(false);
  };

  const sentLogs = logs.filter((log) => log.type === "sent");
  const failedLogs = logs.filter((log) => log.type === "failed");
  const webhookLogs = logs.filter((log) => log.type === "webhook");

  const LogItem = ({ log }: { log: LogMessage }) => {
    const [expanded, setExpanded] = useState(false);

    return (
      <div className="border-b border-border py-3 px-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            {log.type === "sent" && <CheckCircle className="h-5 w-5 text-green-500" />}
            {log.type === "failed" && <XCircle className="h-5 w-5 text-red-500" />}
            {log.type === "webhook" && <Webhook className="h-5 w-5 text-blue-500" />}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {log.type === "sent" && "Mensagem Enviada"}
                  {log.type === "failed" && "Falha no Envio"}
                  {log.type === "webhook" && "Webhook Recebido"}
                </span>
                {log.campaign_name && (
                  <Badge variant="outline" className="text-xs">
                    {log.campaign_name}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(log.timestamp).toLocaleString("pt-BR")}
              </span>
            </div>
            
            {(log.type === "sent" || log.type === "failed") && (
              <>
                <p className="text-sm text-muted-foreground">
                  {log.contact_name} • {log.contact_phone}
                </p>
                {log.message && (
                  <p className="text-sm text-foreground line-clamp-2">{log.message}</p>
                )}
                {log.error && (
                  <p className="text-sm text-red-500">{log.error}</p>
                )}
              </>
            )}

            {log.type === "webhook" && log.webhook_data && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                  {expanded ? "Ocultar" : "Ver"} dados
                </Button>
                {expanded && (
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(log.webhook_data, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

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
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Logs de Mensagens</h1>
          <p className="text-muted-foreground">Histórico completo de envios e eventos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", autoRefresh && "animate-spin")} />
            {autoRefresh ? "Atualização Ativa" : "Auto Atualizar"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as campanhas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as campanhas</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
                <SelectItem value="failed">Falhas</SelectItem>
                <SelectItem value="webhook">Webhooks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentLogs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Falhas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedLogs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webhooks</CardTitle>
            <Webhook className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{webhookLogs.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Tabs */}
      <Card>
        <Tabs defaultValue="all" className="w-full">
          <CardHeader>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">Todos ({logs.length})</TabsTrigger>
              <TabsTrigger value="sent">Enviados ({sentLogs.length})</TabsTrigger>
              <TabsTrigger value="failed">Falhas ({failedLogs.length})</TabsTrigger>
              <TabsTrigger value="webhook">Webhooks ({webhookLogs.length})</TabsTrigger>
            </TabsList>
          </CardHeader>
          
          <ScrollArea className="h-[600px]">
            <TabsContent value="all" className="mt-0">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum log encontrado
                </div>
              ) : (
                logs.map((log, index) => <LogItem key={index} log={log} />)
              )}
            </TabsContent>

            <TabsContent value="sent" className="mt-0">
              {sentLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhuma mensagem enviada
                </div>
              ) : (
                sentLogs.map((log, index) => <LogItem key={index} log={log} />)
              )}
            </TabsContent>

            <TabsContent value="failed" className="mt-0">
              {failedLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhuma falha registrada
                </div>
              ) : (
                failedLogs.map((log, index) => <LogItem key={index} log={log} />)
              )}
            </TabsContent>

            <TabsContent value="webhook" className="mt-0">
              {webhookLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum webhook recebido
                </div>
              ) : (
                webhookLogs.map((log, index) => <LogItem key={index} log={log} />)
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </Card>
    </div>
  );
}
