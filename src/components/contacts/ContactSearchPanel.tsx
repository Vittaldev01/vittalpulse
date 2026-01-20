import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ContactSearchResult {
  id: string;
  name: string | null;
  phone: string;
  list_id: string;
  list_name: string;
  preferred_connection_id: string | null;
}

export function ContactSearchPanel() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<ContactSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Digite um termo de busca",
        description: "Informe um nome ou telefone para pesquisar",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      // Buscar contatos que contenham o termo no nome ou telefone
      const { data: contacts, error } = await supabase
        .from("contacts")
        .select(`
          id,
          name,
          phone,
          list_id,
          preferred_connection_id,
          contact_lists (
            name
          )
        `)
        .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .order("phone");

      if (error) throw error;

      if (!contacts || contacts.length === 0) {
        toast({
          title: "Nenhum contato encontrado",
          description: "Tente outro termo de busca",
        });
        setResults([]);
        return;
      }

      // Transformar dados para o formato esperado
      const formattedResults: ContactSearchResult[] = contacts.map((contact: any) => ({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        list_id: contact.list_id,
        list_name: contact.contact_lists?.name || "Lista sem nome",
        preferred_connection_id: contact.preferred_connection_id,
      }));

      setResults(formattedResults);
    } catch (error: any) {
      toast({
        title: "Erro ao buscar contatos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeleteFromList = async (contactId: string, listName: string) => {
    if (!confirm(`Confirma a exclusão deste contato da lista "${listName}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contactId);

      if (error) throw error;

      toast({
        title: "Contato removido!",
        description: `Contato excluído da lista "${listName}"`,
      });

      // Remover da lista de resultados
      setResults(results.filter((r) => r.id !== contactId));
    } catch (error: any) {
      toast({
        title: "Erro ao excluir contato",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteFromAll = async (phone: string) => {
    const count = results.filter((r) => r.phone === phone).length;
    
    if (!confirm(`Confirma a exclusão deste contato de TODAS as ${count} lista(s)?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("phone", phone);

      if (error) throw error;

      toast({
        title: "Contato removido de todas as listas!",
        description: `${count} registro(s) excluído(s)`,
      });

      // Remover todos com esse telefone da lista de resultados
      setResults(results.filter((r) => r.phone !== phone));
    } catch (error: any) {
      toast({
        title: "Erro ao excluir contato",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
    setResults([]);
  };

  // Agrupar resultados por telefone para facilitar visualização
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.phone]) {
      acc[result.phone] = [];
    }
    acc[result.phone].push(result);
    return acc;
  }, {} as Record<string, ContactSearchResult[]>);

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Search className="h-5 w-5" />
          Buscar Contato Globalmente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Digite nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? "Buscando..." : "Buscar"}
          </Button>
          {results.length > 0 && (
            <Button variant="outline" onClick={clearSearch}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {Object.keys(groupedResults).length} contato(s) encontrado(s) em {results.length} lista(s)
            </div>

            {Object.entries(groupedResults).map(([phone, contactsInLists]) => (
              <div key={phone} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-foreground">
                      {contactsInLists[0].name || "Sem nome"}
                    </div>
                    <div className="text-sm text-muted-foreground">{phone}</div>
                    {contactsInLists[0].preferred_connection_id && (
                      <Badge variant="secondary" className="mt-1">
                        Chip Oficial Configurado
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteFromAll(phone)}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Excluir de Todas
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lista</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contactsInLists.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>{contact.list_name}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFromList(contact.id, contact.list_name)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
