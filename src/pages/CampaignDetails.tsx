import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Play, Pause, StopCircle, MoreVertical, Send, FileText, ClipboardList, AlertCircle, Settings } from "lucide-react";
import { useCampaignDetails } from "@/hooks/useCampaignDetails";
import { CampaignStats } from "@/components/campaigns/CampaignStats";
import { ContactStatusTable } from "@/components/campaigns/ContactStatusTable";
import { WhatsAppPreview } from "@/components/campaigns/WhatsAppPreview";
import { SimpleDispatchReport } from "@/components/campaigns/SimpleDispatchReport";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

export default function CampaignDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    campaign,
    messages,
    stats,
    hourlyData,
    responsesCount,
    hasFollowUp,
    isLoading,
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    cancelCampaign,
    sendNextMessage,
    campaignConnections,
    disconnectedChips,
    hasDisconnectedChip,
    resumeAfterReconnection,
  } = useCampaignDetails(id!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Campanha não encontrada</p>
      </div>
    );
  }

  // Dados para o gráfico de pizza
  const pieData = [
    { name: 'Enviados', value: stats.sent, color: '#22c55e' },
    { name: 'Pendentes', value: stats.pending, color: '#eab308' },
    { name: 'Falhas', value: stats.failed, color: '#ef4444' },
  ].filter(item => item.value > 0);

  // Parse das mensagens para preview
  const previewMessages = campaign.messages ? JSON.parse(campaign.messages) : { part1: [], part2: [] };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Alerta de Chip Desconectado */}
      {campaign.pause_reason === 'chip_disconnected' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Chip Desconectado</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              A campanha foi pausada porque o chip{' '}
              <strong>{disconnectedChips?.[0]?.whatsapp_connections?.name}</strong>{' '}
              está desconectado.
            </p>
            <p className="text-sm">
              Reconecte o chip na página de Conexões e clique em "Retomar Envio" para continuar.
            </p>
            <div className="flex gap-2 mt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/connections')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Ir para Conexões
              </Button>
              {!hasDisconnectedChip && (
                <Button
                  size="sm"
                  onClick={() => resumeAfterReconnection.mutate()}
                  disabled={resumeAfterReconnection.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Retomar Envio
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/campaigns")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{campaign.name}</h1>
            <p className="text-muted-foreground">Lista: {campaign.contact_lists?.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {campaign.status === 'draft' && (
            <Button
              onClick={() => startCampaign.mutate()}
              disabled={startCampaign.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Play className="h-4 w-4 mr-2" />
              Iniciar Disparo
            </Button>
          )}

          {campaign.status === 'running' && (
            <>
              <Button
                variant="secondary"
                onClick={() => sendNextMessage.mutate()}
                disabled={sendNextMessage.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Retomar Envio
              </Button>
              <Button
                variant="outline"
                onClick={() => pauseCampaign.mutate()}
                disabled={pauseCampaign.isPending}
              >
                <Pause className="h-4 w-4 mr-2" />
                Pausar
              </Button>
            </>
          )}

          {campaign.status === 'paused' && campaign.pause_reason === 'chip_disconnected' && (
            hasDisconnectedChip ? (
              <Button variant="outline" disabled>
                <AlertCircle className="h-4 w-4 mr-2 text-destructive" />
                Aguardando reconexão do chip
              </Button>
            ) : (
              <Button
                onClick={() => resumeAfterReconnection.mutate()}
                disabled={resumeAfterReconnection.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Retomar Envio
              </Button>
            )
          )}

          {campaign.status === 'paused' && campaign.pause_reason !== 'chip_disconnected' && (
            <Button
              variant="outline"
              onClick={() => resumeCampaign.mutate()}
              disabled={resumeCampaign.isPending}
              className="border-primary text-primary"
            >
              <Play className="h-4 w-4 mr-2" />
              Retomar
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => navigate(`/campaigns/${id}/follow-up`)}
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            Ver Follow-up
          </Button>

          {campaign.campaign_type === 'interactive' && (
            <Button
              variant="outline"
              onClick={() => navigate(`/campaigns/${id}/interaction-report`)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Ver Relatório de Interação
            </Button>
          )}

          {(campaign.status === 'running' || campaign.status === 'paused') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    if (confirm("Tem certeza que deseja cancelar esta campanha?")) {
                      cancelCampaign.mutate();
                    }
                  }}
                  className="text-destructive"
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  Cancelar Campanha
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <CampaignStats campaign={campaign} stats={stats} responsesCount={responsesCount} />

      {/* Relatórios Condicionais */}
      {campaign.status !== 'draft' && (
        <div className="space-y-4">
          {campaign.campaign_type === 'interactive' ? (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Disparo com Interação</CardTitle>
                <CardDescription>
                  Visualize o funil de conversão M1 → M2 desta campanha
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate(`/campaigns/${id}/interaction-report`)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Ver Relatório de Interação
                </Button>
              </CardContent>
            </Card>
          ) : hasFollowUp ? (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Disparo com Follow-up</CardTitle>
                <CardDescription>
                  Esta campanha possui follow-up configurado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate(`/campaigns/${id}/follow-up`)}>
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Ver Relatório de Follow-up
                </Button>
              </CardContent>
            </Card>
          ) : (
            <SimpleDispatchReport campaignId={id!} />
          )}
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Status dos Disparos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => 
                    `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Line Chart */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Disparos por Hora</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="hour" 
                  tick={{ fontSize: 12 }}
                  interval={2}
                />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="messages" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  dot={{ fill: '#22c55e' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Details Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Contact Status Table */}
        <ContactStatusTable 
          messages={messages || []} 
          connectionName={campaign.whatsapp_connections?.name || 'N/A'}
        />

        {/* Message Preview */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Preview das Mensagens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewMessages.part1 && previewMessages.part1.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Mensagem 1</h4>
                <div className="space-y-2">
                  {previewMessages.part1.slice(0, 3).map((msg: any, idx: number) => (
                    <div key={idx} className="p-3 bg-muted rounded-lg">
                      <div className="text-xs text-primary font-semibold mb-1">
                        Variação #{idx + 1}
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {msg.text.substring(0, 100)}
                        {msg.text.length > 100 && '...'}
                      </p>
                    </div>
                  ))}
                  {previewMessages.part1.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{previewMessages.part1.length - 3} variações
                    </p>
                  )}
                </div>
              </div>
            )}

            {previewMessages.part2 && previewMessages.part2.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Mensagem 2</h4>
                <div className="space-y-2">
                  {previewMessages.part2.slice(0, 3).map((msg: any, idx: number) => (
                    <div key={idx} className="p-3 bg-muted rounded-lg">
                      <div className="text-xs text-purple-500 font-semibold mb-1">
                        Variação #{idx + 1}
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {msg.text.substring(0, 100)}
                        {msg.text.length > 100 && '...'}
                      </p>
                    </div>
                  ))}
                  {previewMessages.part2.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{previewMessages.part2.length - 3} variações
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
