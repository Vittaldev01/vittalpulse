import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MessageCircle, Info } from "lucide-react";
import { useSimpleDispatchReport } from "@/hooks/useSimpleDispatchReport";

interface SimpleDispatchReportProps {
  campaignId: string;
}

export function SimpleDispatchReport({ campaignId }: SimpleDispatchReportProps) {
  const { data: contacts, isLoading } = useSimpleDispatchReport(campaignId);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedResponse, setSelectedResponse] = useState<{
    message: string;
    date: string;
  } | null>(null);

  const itemsPerPage = 10;

  // Filtrar SOMENTE quem respondeu
  const respondedContacts = contacts?.filter(contact => contact.has_response) || [];

  // Calcular paginação
  const totalPages = Math.ceil(respondedContacts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContacts = respondedContacts.slice(startIndex, endIndex);

  const stats = {
    total: contacts?.length || 0,
    responded: respondedContacts.length,
    notResponded: (contacts?.length || 0) - respondedContacts.length,
  };

  // Resetar página ao mudar dados
  useEffect(() => {
    setCurrentPage(1);
  }, [contacts]);

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Card className="border-border bg-card">
        <CardHeader>
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Relatório de Disparo Simples
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Contatos que responderam à sua campanha
            </CardDescription>
          </div>

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="text-sm text-blue-600">Total de Contatos</div>
                <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-1">
                  <div className="text-sm text-green-600">Respostas desta Campanha</div>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-green-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Apenas respostas recebidas após o envio desta campanha</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-2xl font-bold text-green-700">{stats.responded}</div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-4">
                <div className="text-sm text-orange-600">Não Responderam</div>
                <div className="text-2xl font-bold text-orange-700">{stats.notResponded}</div>
              </CardContent>
            </Card>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Mensagem Enviada</TableHead>
                  <TableHead>Data da Resposta</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      Resposta
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Mostra apenas respostas recebidas após o envio desta campanha</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma resposta recebida ainda
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedContacts.map((contact) => (
                    <TableRow key={contact.contact_id}>
                      <TableCell className="font-medium">
                        {contact.contact_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.contact_phone}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(contact.message_sent_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(contact.response_received_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setSelectedResponse({
                              message: contact.response_message || "",
                              date: contact.response_received_at || "",
                            })
                          }
                        >
                          Ver Resposta
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Controles de Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages} • Mostrando {startIndex + 1} a {Math.min(endIndex, respondedContacts.length)} de {respondedContacts.length} respostas
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para ver resposta */}
      <Dialog open={!!selectedResponse} onOpenChange={() => setSelectedResponse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resposta do Contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Data/Hora</p>
              <p className="font-medium">
                {selectedResponse ? formatDateTime(selectedResponse.date) : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mensagem</p>
              <Card className="mt-2 p-4 bg-muted">
                <p className="whitespace-pre-wrap">{selectedResponse?.message}</p>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
