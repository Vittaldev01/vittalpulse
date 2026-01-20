import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInteractionReport } from "@/hooks/useInteractionReport";
import { ConversionFunnelChart } from "@/components/campaigns/ConversionFunnelChart";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function CampaignInteractionReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { contacts, stats, isLoading } = useInteractionReport(id || "");

  if (!id) {
    return <div>ID da campanha não encontrado</div>;
  }

  const getStageLabel = (stage: string) => {
    const labels: Record<string, { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      waiting_message1: { text: "Aguardando M1", variant: "secondary" },
      waiting_message1_response: { text: "Aguardando Resposta M1", variant: "outline" },
      waiting_message2: { text: "Aguardando M2", variant: "secondary" },
      waiting_message2_response: { text: "Aguardando Resposta M2", variant: "outline" },
      timeout_message1: { text: "Timeout M1", variant: "destructive" },
      timeout_message2: { text: "Timeout M2", variant: "destructive" },
      completed: { text: "Completo", variant: "default" },
      in_followup: { text: "Em Follow-up", variant: "secondary" },
    };
    return labels[stage] || { text: stage, variant: "default" };
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/campaigns/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Relatório de Interações</h1>
          <p className="text-muted-foreground">
            Acompanhe o fluxo de mensagens interativas com os contatos
          </p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Respondeu M1</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.respondedM1}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.respondedM1 / stats.total) * 100) : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebeu M2</CardTitle>
            <Send className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.receivedM2}</div>
            <p className="text-xs text-muted-foreground">
              {stats.respondedM1 > 0 ? Math.round((stats.receivedM2 / stats.respondedM1) * 100) : 0}% dos que responderam
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Respondeu M2</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.respondedM2}</div>
            <p className="text-xs text-muted-foreground">
              {stats.respondedM1 > 0 ? Math.round((stats.respondedM2 / stats.respondedM1) * 100) : 0}% dos que responderam M1
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Follow-up</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inFollowup}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Funil de Conversão */}
      <Card>
        <CardHeader>
          <CardTitle>Funil de Conversão M1 → M2</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visualize a jornada dos leads através das mensagens interativas
          </p>
        </CardHeader>
        <CardContent>
          <ConversionFunnelChart stats={stats} />
        </CardContent>
      </Card>

      {/* Tabela de Contatos */}
      <Card>
        <CardHeader>
          <CardTitle>Status por Contato</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum contato encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status Atual</TableHead>
                  <TableHead className="text-center">M1 Enviada</TableHead>
                  <TableHead className="text-center">Respondeu M1</TableHead>
                  <TableHead className="text-center">M2 Enviada</TableHead>
                  <TableHead className="text-center">Respondeu M2</TableHead>
                  <TableHead className="text-center">Follow-up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => {
                  const stageInfo = getStageLabel(contact.current_stage);
                  return (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{contact.contact_name}</div>
                          <div className="text-sm text-muted-foreground">{contact.contact_phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={stageInfo.variant}>{stageInfo.text}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {contact.message1_sent_at ? (
                          <div className="flex flex-col items-center">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="text-xs text-muted-foreground mt-1">
                              {formatDate(contact.message1_sent_at)}
                            </span>
                          </div>
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {contact.message1_response_received_at ? (
                          <div className="flex flex-col items-center">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="text-xs text-muted-foreground mt-1">
                              {formatDate(contact.message1_response_received_at)}
                            </span>
                          </div>
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {contact.message2_sent_at ? (
                          <div className="flex flex-col items-center">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="text-xs text-muted-foreground mt-1">
                              {formatDate(contact.message2_sent_at)}
                            </span>
                          </div>
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {contact.message2_response_received_at ? (
                          <div className="flex flex-col items-center">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="text-xs text-muted-foreground mt-1">
                              {formatDate(contact.message2_response_received_at)}
                            </span>
                          </div>
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {contact.followup_started ? (
                          <Badge variant="default">Sim</Badge>
                        ) : (
                          <Badge variant="outline">Não</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
