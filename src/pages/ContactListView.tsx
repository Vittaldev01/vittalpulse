import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Pin, Clock, Pencil, Info, Phone, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConnections } from "@/hooks/useConnections";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ContactPhone {
  id: string;
  phone: string;
  is_primary: boolean;
  phone_type: string | null;
  is_whatsapp: boolean | null;
  validated_at: string | null;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  preferred_connection_id: string | null;
  preferred_connection_name: string | null;
  customData?: { [key: string]: string };
  phones: ContactPhone[];
}

interface CustomField {
  id: string;
  field_name: string;
  field_type: string;
}

interface ContactList {
  id: string;
  name: string;
  description: string | null;
  total_contacts: number;
}

export default function ContactListView() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { connections } = useConnections();
  
  const [list, setList] = useState<ContactList | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingChip, setIsUpdatingChip] = useState(false);

  const activeConnections = connections?.filter(c => c.status === 'connected') || [];

  useEffect(() => {
    if (listId) {
      loadData();
    }
  }, [listId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Buscar informações da lista
      const { data: listData, error: listError } = await supabase
        .from("contact_lists")
        .select("*")
        .eq("id", listId)
        .single();

      if (listError) throw listError;
      setList(listData);

      // Buscar campos personalizados da lista
      const { data: fieldsData, error: fieldsError } = await supabase
        .from("custom_fields")
        .select("*")
        .eq("list_id", listId);

      if (fieldsError) throw fieldsError;
      setCustomFields(fieldsData || []);

      // Buscar contatos da lista
      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select(`
          *,
          whatsapp_connections!preferred_connection_id(name)
        `)
        .eq("list_id", listId)
        .order("created_at", { ascending: false });

      if (contactsError) throw contactsError;

      // Buscar dados personalizados e telefones de cada contato
      const contactsWithData = await Promise.all(
        (contactsData || []).map(async (contact) => {
          // Buscar dados personalizados
          const { data: customData } = await supabase
            .from("contact_custom_data")
            .select("field_id, value")
            .eq("contact_id", contact.id);

          const customDataMap: { [key: string]: string } = {};
          customData?.forEach((item) => {
            const field = fieldsData?.find((f) => f.id === item.field_id);
            if (field) {
              customDataMap[field.field_name] = item.value || "";
            }
          });

          // Buscar todos os telefones do contato
          const { data: phonesData } = await supabase
            .from("contact_phones")
            .select("id, phone, is_primary, phone_type, is_whatsapp, validated_at")
            .eq("contact_id", contact.id)
            .order("is_primary", { ascending: false });

          // Extrair nome da conexão preferida do JOIN
          const preferredConnectionName = contact.whatsapp_connections?.name || null;

          return {
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            created_at: contact.created_at,
            preferred_connection_id: contact.preferred_connection_id,
            preferred_connection_name: preferredConnectionName,
            customData: customDataMap,
            phones: phonesData || [],
          };
        })
      );

      setContacts(contactsWithData);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar contatos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Tem certeza que deseja excluir este contato?")) return;

    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contactId);

      if (error) throw error;

      toast({
        title: "Contato excluído",
        description: "O contato foi removido com sucesso.",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleChangeChip = async (phone: string, newChipId: string) => {
    if (!confirm(`Tem certeza que deseja alterar o chip oficial do número ${phone}?\n\nEsta ação afetará TODAS as listas onde este número aparece.`)) {
      return;
    }

    setIsUpdatingChip(true);
    try {
      const selectedConnection = activeConnections.find(c => c.id === newChipId);
      
      if (!selectedConnection) {
        throw new Error('Chip selecionado não encontrado ou não está conectado');
      }

      // Atualizar TODOS os contatos com este telefone
      const { data, error } = await supabase
        .from('contacts')
        .update({ preferred_connection_id: newChipId })
        .eq('phone', phone)
        .select('id');

      if (error) throw error;

      const updatedCount = data?.length || 0;

      toast({
        title: "✅ Chip oficial atualizado!",
        description: `${updatedCount} registro(s) atualizado(s) para usar "${selectedConnection.name}"`,
      });

      // Recarregar a lista atual
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar chip",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingChip(false);
    }
  };

  const getPhoneStatusBadge = (phoneData: ContactPhone) => {
    if (!phoneData.validated_at) {
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <HelpCircle className="h-3 w-3" />
          Não validado
        </Badge>
      );
    }

    if (phoneData.is_whatsapp === true || phoneData.phone_type === 'whatsapp') {
      return (
        <Badge variant="outline" className="text-xs gap-1 bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="h-3 w-3" />
          WhatsApp
        </Badge>
      );
    }

    if (phoneData.is_whatsapp === false || phoneData.phone_type === 'invalid' || phoneData.phone_type === 'landline') {
      return (
        <Badge variant="outline" className="text-xs gap-1 bg-red-500/10 text-red-600 border-red-500/20">
          <XCircle className="h-3 w-3" />
          {phoneData.phone_type === 'landline' ? 'Fixo' : 'Inválido'}
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-xs gap-1">
        <HelpCircle className="h-3 w-3" />
        Desconhecido
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/contacts")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Lista não encontrada</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/contacts")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{list.name}</h1>
            <p className="text-muted-foreground">{list.description || "Lista de contatos"}</p>
          </div>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground">Contatos</CardTitle>
                <CardDescription>
                  Total de {contacts.length} contato{contacts.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {contacts.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Alerta informativo sobre chip oficial */}
            {activeConnections.length > 0 && (
              <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  O <strong>chip oficial</strong> é único por número de telefone. Ao alterar, 
                  <strong> todas as listas</strong> com este número serão atualizadas automaticamente.
                </AlertDescription>
              </Alert>
            )}

            {contacts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  Nenhum contato nesta lista. Use o botão "Importar" para adicionar contatos.
                </p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefones</TableHead>
                      <TableHead>Chip Oficial</TableHead>
                      {customFields.map((field) => (
                        <TableHead key={field.id}>{field.field_name}</TableHead>
                      ))}
                      <TableHead>Adicionado em</TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">{contact.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {contact.phones.length > 0 ? (
                              contact.phones.map((phoneData) => (
                                <div key={phoneData.id} className="flex items-center gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-1">
                                        {phoneData.is_primary && (
                                          <Phone className="h-3 w-3 text-primary" />
                                        )}
                                        <span className="font-mono text-sm">{phoneData.phone}</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {phoneData.is_primary ? 'Telefone principal' : 'Telefone secundário'}
                                    </TooltipContent>
                                  </Tooltip>
                                  {getPhoneStatusBadge(phoneData)}
                                </div>
                              ))
                            ) : (
                              <span className="font-mono text-sm">{contact.phone}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {/* Badge com chip atual */}
                            {contact.preferred_connection_id && contact.preferred_connection_name ? (
                              <Badge 
                                variant="outline" 
                                className="bg-green-500/10 text-green-600 border-green-500/20 gap-1"
                              >
                                <Pin className="h-3 w-3" />
                                {contact.preferred_connection_name}
                              </Badge>
                            ) : contact.preferred_connection_id && !contact.preferred_connection_name ? (
                              <Badge 
                                variant="outline" 
                                className="bg-muted text-muted-foreground gap-1"
                              >
                                <Pin className="h-3 w-3" />
                                Não disponível
                              </Badge>
                            ) : (
                              <Badge 
                                variant="outline" 
                                className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 gap-1"
                              >
                                <Clock className="h-3 w-3" />
                                Pendente
                              </Badge>
                            )}

                            {/* Dropdown de seleção de chip */}
                            {activeConnections.length > 0 ? (
                              <Select 
                                value={contact.preferred_connection_id || ""}
                                onValueChange={(newChipId) => handleChangeChip(contact.phone, newChipId)}
                                disabled={isUpdatingChip}
                              >
                                <SelectTrigger className="w-[140px] h-8 text-xs">
                                  <Pencil className="h-3 w-3 mr-1" />
                                  <SelectValue placeholder="Alterar" />
                                </SelectTrigger>
                                <SelectContent>
                                  {activeConnections.map(conn => (
                                    <SelectItem key={conn.id} value={conn.id}>
                                      {conn.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                Sem chips
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        {customFields.map((field) => (
                          <TableCell key={field.id}>
                            {contact.customData?.[field.field_name] || "-"}
                          </TableCell>
                        ))}
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(contact.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteContact(contact.id)}
                            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Legenda de Status */}
                <div className="mt-6 pt-4 border-t border-border px-4 pb-4">
                  <p className="text-sm font-medium text-foreground mb-3">Legenda:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                        <CheckCircle className="h-3 w-3" />
                        WhatsApp
                      </Badge>
                      <span className="text-muted-foreground">Validado</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 gap-1">
                        <XCircle className="h-3 w-3" />
                        Inválido
                      </Badge>
                      <span className="text-muted-foreground">Não é WhatsApp</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        <HelpCircle className="h-3 w-3" />
                        Não validado
                      </Badge>
                      <span className="text-muted-foreground">Pendente</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-primary" />
                      <span className="text-muted-foreground">Telefone principal</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
