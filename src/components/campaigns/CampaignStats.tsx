import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MessageSquare, AlertCircle, CheckCircle2, Settings, MessageCircle } from "lucide-react";

interface CampaignStatsProps {
  campaign: any;
  stats: {
    pending: number;
    sent: number;
    failed: number;
  };
  responsesCount: number;
}

const getStatusBadge = (status: string) => {
  const variants = {
    draft: { text: "Rascunho", className: "bg-secondary" },
    running: { text: "Em Execução", className: "bg-yellow-500 text-black" },
    paused: { text: "Pausada", className: "bg-yellow-400 text-black" },
    completed: { text: "Concluída", className: "bg-green-500 text-white" },
    cancelled: { text: "Cancelada", className: "bg-destructive" },
    scheduled: { text: "Agendada", className: "bg-purple-500 text-white" },
  };

  const config = variants[status as keyof typeof variants] || variants.draft;
  return <Badge className={config.className}>{config.text}</Badge>;
};

export function CampaignStats({ campaign, stats, responsesCount }: CampaignStatsProps) {
  // Tratar allowed_days que pode vir como JSON array ou string CSV
  const parseAllowedDays = () => {
    if (!campaign.allowed_days) return [];
    
    // Se já for array, retornar diretamente
    if (Array.isArray(campaign.allowed_days)) return campaign.allowed_days;
    
    // Se for string, tentar parse como JSON
    if (typeof campaign.allowed_days === 'string') {
      // Verificar se começa com [ (JSON array)
      if (campaign.allowed_days.trim().startsWith('[')) {
        try {
          return JSON.parse(campaign.allowed_days);
        } catch {
          return [];
        }
      }
      // Caso contrário, assumir que é CSV e dividir
      return campaign.allowed_days.split(',').map((d: string) => d.trim()).filter(Boolean);
    }
    
    return [];
  };
  
  const allowedDays = parseAllowedDays();
  
  // Calcular previsão de finalização
  const calculateEstimate = () => {
    if (campaign.status !== 'running' || stats.sent === 0) return 'N/A';
    
    const elapsed = campaign.started_at 
      ? (new Date().getTime() - new Date(campaign.started_at).getTime()) / 1000 / 60
      : 0;
    
    const rate = stats.sent / elapsed; // mensagens por minuto
    const remaining = stats.pending;
    const estimatedMinutes = remaining / rate;
    
    if (estimatedMinutes < 60) {
      return `~${Math.round(estimatedMinutes)} min`;
    }
    return `~${Math.round(estimatedMinutes / 60)} horas`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Status Card */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {getStatusBadge(campaign.status)}
          {campaign.started_at && (
            <p className="text-xs text-muted-foreground mt-2">
              Iniciado: {new Date(campaign.started_at).toLocaleString('pt-BR')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Estatísticas Card */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Estatísticas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total:</span>
            <span className="text-sm font-bold text-foreground">{campaign.total_messages}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Enviados:
            </span>
            <span className="text-sm font-semibold text-green-500">{stats.sent}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-destructive" />
              Falhas:
            </span>
            <span className="text-sm font-semibold text-destructive">{stats.failed}</span>
          </div>
        </CardContent>
      </Card>

      {/* Respostas Card */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Respostas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total de respostas:</span>
            <span className="text-2xl font-bold text-green-600">{responsesCount}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Contatos que responderam
          </div>
        </CardContent>
      </Card>

      {/* Previsão Card */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Previsão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {calculateEstimate()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.pending} mensagens restantes
          </p>
        </CardContent>
      </Card>

      {/* Configurações Card */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="text-xs">
            <span className="text-muted-foreground">Horário: </span>
            <span className="text-foreground font-medium">
              {campaign.allowed_hours_start} - {campaign.allowed_hours_end}
            </span>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Intervalo: </span>
            <span className="text-foreground font-medium">
              {campaign.min_interval_seconds}-{campaign.max_interval_seconds}s
            </span>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Conexão: </span>
            <span className="text-foreground font-medium">
              {campaign.whatsapp_connections?.name}
            </span>
          </div>
          {allowedDays.length > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground">Dias: </span>
              <span className="text-foreground font-medium">
                {allowedDays.length} dias
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
