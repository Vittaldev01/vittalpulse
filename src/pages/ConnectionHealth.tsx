import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConnectionHealth } from "@/hooks/useConnectionHealth";
import { ConnectionHealthCard } from "@/components/connections/ConnectionHealthCard";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConnectionHealth() {
  const { data: connections, isLoading, refetch, isRefetching } = useConnectionHealth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const healthyCount = connections?.filter(c => c.health_status === "healthy").length || 0;
  const warningCount = connections?.filter(c => c.health_status === "warning").length || 0;
  const criticalCount = connections?.filter(c => c.health_status === "critical").length || 0;
  const inactiveCount = connections?.filter(c => c.health_status === "inactive").length || 0;

  const totalMessages = connections?.reduce((sum, c) => sum + c.total_messages, 0) || 0;
  const totalSent = connections?.reduce((sum, c) => sum + c.sent_messages, 0) || 0;
  const totalFailed = connections?.reduce((sum, c) => sum + c.failed_messages, 0) || 0;
  const overallSuccessRate = totalMessages > 0 ? (totalSent / totalMessages) * 100 : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard de Saúde</h1>
          <p className="text-muted-foreground">
            Monitore a saúde e performance de suas conexões WhatsApp em tempo real
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          disabled={isRefetching}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Resumo Geral */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <div className="text-2xl font-bold text-foreground">
                {connections?.length || 0}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {healthyCount} saudável{healthyCount !== 1 ? 's' : ''} • {warningCount} atenção • {criticalCount} crítico{criticalCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Sucesso Global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div className="text-2xl font-bold text-green-600">
                {overallSuccessRate.toFixed(1)}%
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {totalSent.toLocaleString()} de {totalMessages.toLocaleString()} mensagens
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Mensagens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {totalMessages.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Enviadas por todas as conexões
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Falhas Totais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {totalFailed.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {totalMessages > 0 ? ((totalFailed / totalMessages) * 100).toFixed(1) : 0}% do total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas Críticos */}
      {criticalCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">{criticalCount} conexão(ões) com problemas críticos</span> que requerem atenção imediata.
          </AlertDescription>
        </Alert>
      )}

      {/* Alertas de Atenção */}
      {warningCount > 0 && criticalCount === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">{warningCount} conexão(ões) com avisos</span> que podem precisar de atenção.
          </AlertDescription>
        </Alert>
      )}

      {/* Status das Conexões */}
      {connections && connections.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-semibold text-foreground">Conexões</h2>
            <Badge variant="outline">{connections.length} total</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {connections
              .sort((a, b) => {
                // Ordenar por status de saúde (crítico primeiro)
                const statusOrder = { critical: 0, warning: 1, healthy: 2, inactive: 3 };
                return statusOrder[a.health_status] - statusOrder[b.health_status];
              })
              .map((connection) => (
                <ConnectionHealthCard key={connection.id} connection={connection} />
              ))}
          </div>
        </div>
      )}

      {connections && connections.length === 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Nenhuma Conexão</CardTitle>
            <CardDescription>
              Configure sua primeira conexão WhatsApp para começar a monitorar
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Auto-refresh indicator */}
      <div className="text-center text-xs text-muted-foreground">
        Atualização automática a cada 30 segundos
      </div>
    </div>
  );
}
