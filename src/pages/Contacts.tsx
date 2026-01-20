import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useContactLists } from "@/hooks/useContactLists";
import { ContactListCard } from "@/components/contacts/ContactListCard";
import { NewListDialog } from "@/components/contacts/NewListDialog";
import { ContactSearchPanel } from "@/components/contacts/ContactSearchPanel";

export default function Contacts() {
  const { lists, isLoading, createList, deleteList } = useContactLists();

  const handleCreateList = (name: string, description?: string) => {
    createList.mutate({ name, description });
  };

  const handleDeleteList = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta lista? Todos os contatos serão removidos.")) {
      deleteList.mutate(id);
    }
  };

  const handleImportSuccess = () => {
    // Refetch da lista após importação bem-sucedida
    window.location.reload();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Listas de Contatos</h1>
          <p className="text-muted-foreground">Organize e gerencie seus contatos</p>
        </div>
        <NewListDialog
          onCreateList={handleCreateList}
          isLoading={createList.isPending}
        />
      </div>

      <ContactSearchPanel />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : lists.length === 0 ? (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Suas Listas</CardTitle>
            <CardDescription>Nenhuma lista criada ainda</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Crie sua primeira lista de contatos para começar a enviar campanhas
              </p>
              <NewListDialog
                onCreateList={handleCreateList}
                isLoading={createList.isPending}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <ContactListCard
              key={list.id}
              list={list}
              onDelete={handleDeleteList}
              onImportSuccess={handleImportSuccess}
            />
          ))}
        </div>
      )}
    </div>
  );
}
