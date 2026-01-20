import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageSquare, Users, CheckCircle, TrendingUp, Calendar as CalendarIcon, AlertTriangle, Activity, CheckCircle2 } from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useConnectionHealth } from "@/hooks/useConnectionHealth";
import { useStateMetrics } from "@/hooks/useStateMetrics";
import { StateMetricsSection } from "@/components/dashboard/StateMetricsSection";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(dateRange);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const dateRangeFilter = dateRange?.from && dateRange?.to 
    ? { start: dateRange.from, end: dateRange.to }
    : undefined;
    
  const { stats, dailyStats, recentCampaigns, interactiveStats } = useDashboardStats(dateRangeFilter);
  const { data: connectionHealth } = useConnectionHealth();
  const { data: stateMetrics, isLoading: isLoadingStateMetrics } = useStateMetrics(dateRangeFilter);
  const navigate = useNavigate();

  const criticalConnections = connectionHealth?.filter(c => c.health_status === 'critical').length || 0;
  const warningConnections = connectionHealth?.filter(c => c.health_status === 'warning').length || 0;
  const healthyConnections = connectionHealth?.filter(c => c.health_status === 'healthy').length || 0;

  const applyFilter = () => {
    setDateRange(tempDateRange);
    setIsPopoverOpen(false);
  };

  const selectPreset = (preset: DateRange) => {
    setTempDateRange(preset);
    setDateRange(preset);
    setIsPopoverOpen(false);
  };

  const statsCards = [
    {
      title: "Total de Disparos",
      value: stats.totalSent.toLocaleString("pt-BR"),
      change: stats.sentChange,
      icon: MessageSquare,
      color: "text-primary",
    },
    {
      title: "Respostas Recebidas",
      value: stats.totalResponses.toLocaleString("pt-BR"),
      change: stats.responsesChange,
      icon: CheckCircle,
      color: "text-primary",
      description: "Respostas únicas (M1 + M2)",
    },
    {
      title: "Taxa de Resposta",
      value: `${stats.responseRate.toFixed(1)}%`,
      change: stats.rateChange,
      icon: TrendingUp,
      color: "text-primary",
    },
    {
      title: "Conexões Ativas",
      value: stats.activeConnections.toString(),
      change: "Estável",
      icon: Users,
      color: "text-primary",
    },
  ];
  const presets = [
    { label: "Hoje", value: { from: startOfDay(new Date()), to: endOfDay(new Date()) } },
    { label: "Ontem", value: { from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) } },
    { label: "Últimos 7 dias", value: { from: subDays(new Date(), 7), to: new Date() } },
    { label: "Últimos 30 dias", value: { from: subDays(new Date(), 30), to: new Date() } },
    { label: "Este mês", value: { from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), to: new Date() } },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral das suas campanhas de automação</p>
        </div>
        
        {/* Date Range Picker */}
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} - {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                  </>
                ) : (
                  format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                )
              ) : (
                <span>Selecione o período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="p-3 border-b">
              <div className="space-y-2">
                {presets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => selectPreset(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <Calendar
              mode="range"
              selected={tempDateRange}
              onSelect={setTempDateRange}
              numberOfMonths={2}
              locale={ptBR}
            />
            <div className="p-3 border-t flex gap-2">
              <Button 
                onClick={applyFilter}
                disabled={!tempDateRange?.from || !tempDateRange?.to}
                className="flex-1"
              >
                Aplicar
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setTempDateRange(dateRange);
                  setIsPopoverOpen(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Alerta de Saúde das Conexões */}
      {connectionHealth && connectionHealth.length > 0 && (criticalConnections > 0 || warningConnections > 0) && (
        <Alert variant={criticalConnections > 0 ? "destructive" : "default"} className="border-l-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {criticalConnections > 0 ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <Activity className="h-5 w-5" />
              )}
              <AlertDescription className="text-sm">
                {criticalConnections > 0 && (
                  <span className="font-semibold">
                    {criticalConnections} conexão(ões) com problemas críticos
                  </span>
                )}
                {criticalConnections === 0 && warningConnections > 0 && (
                  <span className="font-semibold">
                    {warningConnections} conexão(ões) com avisos que precisam de atenção
                  </span>
                )}
                {healthyConnections > 0 && (
                  <span className="text-muted-foreground ml-2">
                    • {healthyConnections} saudável{healthyConnections !== 1 ? 's' : ''}
                  </span>
                )}
              </AlertDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/connection-health")}
            >
              Ver Detalhes
            </Button>
          </div>
        </Alert>
      )}

      {/* Status Geral Positivo */}
      {connectionHealth && connectionHealth.length > 0 && criticalConnections === 0 && warningConnections === 0 && (
        <Alert className="border-green-500 bg-green-500/10">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertDescription className="text-sm">
            <span className="font-semibold text-green-700">
              Todas as {connectionHealth.length} conexões estão funcionando perfeitamente!
            </span>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <Card
            key={stat.title}
            className="border-border bg-card hover:shadow-lg hover:glow-neon transition-all duration-300"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description ? (
                  stat.description
                ) : (
                  <>
                    <span className="text-primary font-medium">{stat.change}</span> vs. mês anterior
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cards de Métricas Interativas */}
      {interactiveStats && (interactiveStats.m1Responses > 0 || interactiveStats.m2Responses > 0) && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Métricas de Campanhas Interativas
            </h3>
            <p className="text-sm text-muted-foreground">
              Respostas únicas à primeira e segunda mensagem
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border bg-card hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Respostas à Mensagem 1
                </CardTitle>
                <MessageSquare className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {interactiveStats.m1Responses.toLocaleString("pt-BR")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Leads únicos que responderam à primeira mensagem
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Respostas à Mensagem 2
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {interactiveStats.m2Responses.toLocaleString("pt-BR")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Leads únicos que responderam à segunda mensagem
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Métricas por Estado */}
      {(stateMetrics && stateMetrics.length > 0) || isLoadingStateMetrics ? (
        <StateMetricsSection metrics={stateMetrics || []} isLoading={isLoadingStateMetrics} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Disparos por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {dailyStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem"
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <p>Nenhum dado disponível nos últimos 7 dias</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Campanhas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentCampaigns.length > 0 ? (
                recentCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                  >
                    <div>
                      <p className="font-medium text-foreground">{campaign.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {campaign.progress}% concluída ({campaign.sent}/{campaign.total})
                      </p>
                    </div>
                    <div className="h-2 w-24 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${campaign.progress}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <p>Nenhuma campanha encontrada</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
