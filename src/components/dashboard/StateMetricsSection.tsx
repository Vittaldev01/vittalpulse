import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Send, MessageCircle, MapPin, TrendingUp } from "lucide-react";
import { StateMetric } from "@/hooks/useStateMetrics";

interface StateMetricsSectionProps {
  metrics: StateMetric[];
  isLoading?: boolean;
}

export function StateMetricsSection({ metrics, isLoading }: StateMetricsSectionProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Métricas por Estado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-40 bg-muted rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Métricas por Estado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <Card key={metric.state} className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold">
                    {metric.state}
                  </CardTitle>
                  <span className="text-sm font-medium px-2 py-1 bg-primary/10 text-primary rounded">
                    {metric.stateAbbr}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {metric.campaignCount} campanha{metric.campaignCount !== 1 ? 's' : ''}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Contatos</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {metric.totalContacts.toLocaleString('pt-BR')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Send className="h-4 w-4" />
                    <span className="text-sm">Disparos Únicos</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {metric.uniqueDispatches.toLocaleString('pt-BR')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-sm">Respostas</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {metric.responses.toLocaleString('pt-BR')}
                  </span>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm">Taxa de Resposta</span>
                    </div>
                    <span className={`font-bold ${
                      metric.responseRate >= 20 
                        ? 'text-green-600 dark:text-green-400' 
                        : metric.responseRate >= 10 
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-muted-foreground'
                    }`}>
                      {metric.responseRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
