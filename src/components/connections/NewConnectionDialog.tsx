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
import { Plus } from "lucide-react";

interface NewConnectionDialogProps {
  onCreateConnection: (name: string) => void;
  isLoading: boolean;
}

export const NewConnectionDialog = ({ onCreateConnection, isLoading }: NewConnectionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreateConnection(name);
      setName("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Nova Conexão
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Nova Conexão WhatsApp</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Dê um nome para identificar esta conexão
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">
                Nome da Conexão
              </Label>
              <Input
                id="name"
                placeholder="Ex: WhatsApp Principal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? "Criando..." : "Criar Conexão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
