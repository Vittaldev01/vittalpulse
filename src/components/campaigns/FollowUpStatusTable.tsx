import { useState, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CalendarIcon, CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";
import { useFollowUpStatus } from "@/hooks/useFollowUpStatus";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";

interface FollowUpStatusTableProps {
  campaignId: string;
}

export function FollowUpStatusTable({ campaignId }: FollowUpStatusTableProps) {
  const { followUpContacts, isLoading, updateNextMessageDate } =
    useFollowUpStatus(campaignId);
  const [selectedResponse, setSelectedResponse] = useState<{
    message: string;
    date: string;
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("12:00");

  // Detectar telefones duplicados
  const duplicatePhones = useMemo(() => {
    const phoneCount = new Map<string, number>();
    followUpContacts.forEach(contact => {
      const count = phoneCount.get(contact.contact_phone) || 0;
      phoneCount.set(contact.contact_phone, count + 1);
    });
    return new Set(
      Array.from(phoneCount.entries())
        .filter(([_, count]) => count > 1)
        .map(([phone]) => phone)
    );
  }, [followUpContacts]);

  const handleDateTimeChange = (statusId: string) => {
    if (!selectedDate) return;
    
    const [hours, minutes] = selectedTime.split(':');
    const dateTime = new Date(selectedDate);
    dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    updateNextMessageDate.mutate({
      statusId,
      newDate: dateTime.toISOString(),
    });
  };

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

  if (followUpContacts.length === 0) {
    return (
      <Card className="p-8 text-center border-border bg-card">
        <p className="text-muted-foreground">
          Nenhum follow-up configurado para esta campanha.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="text-foreground">Contato</TableHead>
              <TableHead className="text-foreground">Telefone</TableHead>
              <TableHead className="text-foreground text-center">
                Etapa Atual
              </TableHead>
              <TableHead className="text-foreground text-center">Status</TableHead>
              <TableHead className="text-foreground">Última Mensagem</TableHead>
              <TableHead className="text-foreground">Próximo Envio</TableHead>
              <TableHead className="text-foreground">Chip Usado</TableHead>
              <TableHead className="text-foreground text-center">
                Resposta
              </TableHead>
              <TableHead className="text-foreground text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {followUpContacts.map((contact) => (
              <TableRow key={contact.id} className="border-border">
                <TableCell className="font-medium text-foreground">
                  {contact.contact_name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {contact.contact_phone}
                    {duplicatePhones.has(contact.contact_phone) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Contato duplicado - mesmo telefone em múltiplas listas</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="border-border">
                    Etapa {contact.current_step}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {contact.is_active ? (
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      <Clock className="w-3 h-3 mr-1" />
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      <XCircle className="w-3 h-3 mr-1" />
                      Pausado
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(contact.last_message_sent_at)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {contact.is_active
                    ? formatDateTime(contact.next_message_at)
                    : "-"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-xs">
                    {contact.used_connection_name || 'N/A'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {contact.response_message ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSelectedResponse({
                          message: contact.response_message!,
                          date: contact.response_received_at!,
                        })
                      }
                      className="text-primary hover:text-primary"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Ver resposta
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      Sem resposta
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {contact.is_active && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border"
                        >
                          <CalendarIcon className="w-4 h-4 mr-1" />
                          Reagendar
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-4 space-y-3" align="start">
                        <div className="space-y-2">
                          <Label>Data</Label>
                          <Calendar
                            mode="single"
                            selected={selectedDate || (contact.next_message_at ? new Date(contact.next_message_at) : undefined)}
                            onSelect={(date) => setSelectedDate(date)}
                            initialFocus
                            className="pointer-events-auto"
                            locale={ptBR}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Horário</Label>
                          <Input
                            type="time"
                            value={selectedTime}
                            onChange={(e) => setSelectedTime(e.target.value)}
                            className="border-border"
                          />
                        </div>
                        <Button 
                          onClick={() => handleDateTimeChange(contact.id)}
                          className="w-full"
                        >
                          Confirmar
                        </Button>
                      </PopoverContent>
                    </Popover>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!selectedResponse}
        onOpenChange={() => setSelectedResponse(null)}
      >
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Resposta do Contato
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Recebida em:{" "}
                {selectedResponse &&
                  formatDateTime(selectedResponse.date)}
              </p>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-foreground whitespace-pre-wrap">
                  {selectedResponse?.message}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
