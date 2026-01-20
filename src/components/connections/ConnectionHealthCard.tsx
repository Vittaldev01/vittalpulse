import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Activity,
  Zap
} from "lucide-react";
import { ConnectionHealth } from "@/hooks/useConnectionHealth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConnectionHealthCardProps {
  connection: ConnectionHealth;
}

export function ConnectionHealthCard({ connection }: ConnectionHealthCardProps) {
  const getStatusIcon = () => {
    switch (connection.health_status) {
      case "healthy":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "critical":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "inactive":
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (connection.health_status) {
      case "healthy":
        return "bg-green-500";
      case "warning":
        return "bg-yellow-500";
      case "critical":
        return "bg-red-500";
      case "inactive":
        return "bg-muted";
    }
  };

  const getStatusText = () => {
    switch (connection.health_status) {
      case "healthy":
        return "Saudável";
      case "warning":
        return "Atenção";
      case "critical":
        return "Crítico";
      case "inactive":
        return "Inativo";
    }
  };

  const formatLastActivity = () => {
    if (!connection.last_activity) return "Nunca";
    try {
      return formatDistanceToNow(new Date(connection.last_activity), {
        addSuffix: true,
        locale: ptBR,
      });
    } catch {
      return "N/A";
    }
  };

  return (
    <Card className="border-border bg-card hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">📱</span>
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">{connection.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant={connection.status === "connected" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {connection.status === "connected" ? "🟢 Conectado" : "🔴 Desconectado"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {connection.phone_number || "Sem número"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <Badge 
              className={`${getStatusColor()} text-white`}
            >
              {getStatusText()}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Métricas principais */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-foreground">{connection.total_messages}</div>
            <div className="text-xs text-muted-foreground">Total Enviadas</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-500/10">
            <div className="text-2xl font-bold text-green-600">{connection.sent_messages}</div>
            <div className="text-xs text-muted-foreground">Sucesso</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/10">
            <div className="text-2xl font-bold text-red-600">{connection.failed_messages}</div>
            <div className="text-xs text-muted-foreground">Falhas</div>
          </div>
        </div>

        {/* Taxa de Sucesso */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-foreground">Taxa de Sucesso</span>
            </div>
            <span className="text-sm font-bold text-green-600">
              {connection.success_rate.toFixed(1)}%
            </span>
          </div>
          <Progress value={connection.success_rate} className="h-2" />
        </div>

        {/* Taxa de Falhas */}
        {connection.failure_rate > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-foreground">Taxa de Falhas</span>
              </div>
              <span className="text-sm font-bold text-red-600">
                {connection.failure_rate.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={connection.failure_rate} 
              className="h-2 [&>div]:bg-red-500" 
            />
          </div>
        )}

        {/* Atividade */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-primary" />
            <div>
              <div className="font-medium text-foreground">{connection.messages_today}</div>
              <div className="text-xs text-muted-foreground">Hoje</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-primary" />
            <div>
              <div className="font-medium text-foreground text-xs">{formatLastActivity()}</div>
              <div className="text-xs text-muted-foreground">Última atividade</div>
            </div>
          </div>
        </div>

        {/* Alertas */}
        {connection.health_issues.length > 0 && (
          <Alert variant={connection.health_status === "critical" ? "destructive" : "default"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="text-xs space-y-1">
                {connection.health_issues.map((issue, idx) => (
                  <li key={idx}>• {issue}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Erros Recentes */}
        {connection.errors_last_hour > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <Zap className="h-4 w-4 text-red-600" />
            <span className="text-xs text-red-600 font-medium">
              {connection.errors_last_hour} erro(s) na última hora
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
