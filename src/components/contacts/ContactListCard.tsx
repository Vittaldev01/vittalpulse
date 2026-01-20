import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Users, Eye } from "lucide-react";
import type { ContactList } from "@/hooks/useContactLists";
import { ImportContactsDialog } from "./ImportContactsDialog";
import { useNavigate } from "react-router-dom";

interface ContactListCardProps {
  list: ContactList;
  onDelete: (id: string) => void;
  onImportSuccess: () => void;
}

export const ContactListCard = ({ list, onDelete, onImportSuccess }: ContactListCardProps) => {
  const navigate = useNavigate();

  return (
    <Card className="border-border bg-card hover:shadow-lg hover:glow-neon transition-all duration-300">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-foreground">{list.name}</CardTitle>
              <CardDescription>
                {list.description || "Sem descrição"}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm">
            <span className="font-semibold text-primary">{list.total_contacts}</span>
            <span className="text-muted-foreground ml-1">contatos</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/contacts/${list.id}`)}
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Eye className="h-4 w-4 mr-1" />
              Ver
            </Button>
            <ImportContactsDialog listId={list.id} onSuccess={onImportSuccess} />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(list.id)}
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Criada em {new Date(list.created_at).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
};
