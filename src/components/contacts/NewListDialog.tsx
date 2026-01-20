import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

interface NewListDialogProps {
  onCreateList: (name: string, description?: string) => void;
  isLoading: boolean;
}

export const NewListDialog = ({ onCreateList, isLoading }: NewListDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreateList(name, description);
      setName("");
      setDescription("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Nova Lista
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Nova Lista de Contatos</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Crie uma lista para organizar seus contatos
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">
                Nome da Lista *
              </Label>
              <Input
                id="name"
                placeholder="Ex: Clientes VIP"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-foreground">
                Descrição (opcional)
              </Label>
              <Textarea
                id="description"
                placeholder="Descreva o propósito desta lista..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? "Criando..." : "Criar Lista"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
