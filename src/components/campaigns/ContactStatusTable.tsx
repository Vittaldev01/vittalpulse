import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

interface ContactStatusTableProps {
  messages: any[];
  connectionName: string;
}

interface GroupedContact {
  contact_id: string;
  phone: string;
  name: string;
  part1: any | null;
  part2: any | null;
  preferred_connection_id?: string;
  preferred_connection_name?: string;
}

export function ContactStatusTable({ messages }: ContactStatusTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Agrupar mensagens por contact_id
  const groupedContacts = useMemo(() => {
    const groups = new Map<string, GroupedContact>();

    messages.forEach(msg => {
      const contactId = msg.contact_id;
      if (!groups.has(contactId)) {
        groups.set(contactId, {
          contact_id: contactId,
          phone: msg.contacts?.phone || '',
          name: msg.contacts?.name || '',
          part1: null,
          part2: null,
          preferred_connection_id: msg.contacts?.preferred_connection_id,
          preferred_connection_name: msg.contacts?.whatsapp_connections?.name || null,
        });
      }
      const group = groups.get(contactId)!;
      if (msg.message_part === 1) group.part1 = msg;
      if (msg.message_part === 2) group.part2 = msg;
    });

    return Array.from(groups.values());
  }, [messages]);

  // Aplicar filtro de status
  const filteredContacts = useMemo(() => {
    if (statusFilter === "all") return groupedContacts;
    
    return groupedContacts.filter(contact => {
      const part1Status = contact.part1?.status;
      const part2Status = contact.part2?.status;
      
      return part1Status === statusFilter || part2Status === statusFilter;
    });
  }, [groupedContacts, statusFilter]);

  const getStatusBadge = (status: string | undefined) => {
    if (!status) {
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground">
          <Clock className="h-3 w-3 mr-1" />
          -
        </Badge>
      );
    }

    const config = {
      pending: { icon: Clock, text: "Pendente", className: "bg-yellow-500 text-black" },
      sent: { icon: CheckCircle2, text: "Enviado", className: "bg-green-500 text-white" },
      failed: { icon: XCircle, text: "Falhou", className: "bg-destructive" },
    };

    const statusConfig = config[status as keyof typeof config] || config.pending;
    const Icon = statusConfig.icon;

    return (
      <Badge className={statusConfig.className}>
        <Icon className="h-3 w-3 mr-1" />
        {statusConfig.text}
      </Badge>
    );
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  // Verificar se um contato tem chips diferentes entre part1 e part2
  const hasInconsistentChips = (contact: GroupedContact) => {
    if (!contact.part1?.used_connection_id || !contact.part2?.used_connection_id) {
      return false;
    }
    return contact.part1.used_connection_id !== contact.part2.used_connection_id;
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">Detalhes dos Contatos</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-foreground">Telefone</TableHead>
                <TableHead className="text-foreground">Nome</TableHead>
                <TableHead className="text-foreground">Chip Oficial</TableHead>
                <TableHead className="text-foreground text-center" colSpan={2}>
                  Mensagem 1
                </TableHead>
                <TableHead className="text-foreground text-center" colSpan={2}>
                  Mensagem 2
                </TableHead>
                <TableHead className="text-foreground text-center">Status</TableHead>
              </TableRow>
              <TableRow className="border-border">
                <TableHead></TableHead>
                <TableHead></TableHead>
                <TableHead></TableHead>
                <TableHead className="text-muted-foreground text-center">Status</TableHead>
                <TableHead className="text-muted-foreground text-center">Chip</TableHead>
                <TableHead className="text-muted-foreground text-center">Status</TableHead>
                <TableHead className="text-muted-foreground text-center">Chip</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhuma mensagem encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => {
                  const inconsistent = hasInconsistentChips(contact);
                  const officialChipName = contact.preferred_connection_name || 'Não definido';
                  const isUsingOfficialChip = 
                    (contact.part1?.used_connection_id === contact.preferred_connection_id) &&
                    (contact.part2?.used_connection_id === contact.preferred_connection_id || !contact.part2);
                  
                  return (
                    <TableRow key={contact.contact_id} className="border-border">
                      <TableCell className="font-medium">
                        {formatPhone(contact.phone)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.name}
                      </TableCell>
                      
                      {/* Chip Oficial */}
                      <TableCell>
                        {contact.preferred_connection_id ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary text-xs w-fit">
                              📌 {officialChipName}
                            </Badge>
                            {isUsingOfficialChip && (
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500 text-xs w-fit">
                                ✓ Consistente
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      
                      {/* Mensagem 1 - Status */}
                      <TableCell className="text-center">
                        {getStatusBadge(contact.part1?.status)}
                      </TableCell>
                      
                      {/* Mensagem 1 - Chip */}
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {contact.part1?.whatsapp_connections?.name || '-'}
                        </Badge>
                      </TableCell>
                      
                      {/* Mensagem 2 - Status */}
                      <TableCell className="text-center">
                        {getStatusBadge(contact.part2?.status)}
                      </TableCell>
                      
                      {/* Mensagem 2 - Chip */}
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {contact.part2?.whatsapp_connections?.name || '-'}
                        </Badge>
                      </TableCell>
                      
                      {/* Status Geral */}
                      <TableCell className="text-center">
                        {inconsistent && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Inconsistente
                          </Badge>
                        )}
                        {!inconsistent && contact.part1?.status === 'sent' && contact.part2?.status === 'sent' && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-sm text-muted-foreground flex items-center justify-between">
          <span>
            Mostrando {filteredContacts.length} de {groupedContacts.length} contatos
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                OK
              </Badge>
              <span className="text-xs">Mesmo chip</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Inconsistente
              </Badge>
              <span className="text-xs">Chips diferentes</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
