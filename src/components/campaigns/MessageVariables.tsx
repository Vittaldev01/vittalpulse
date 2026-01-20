import { Clock, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface MessageVariablesProps {
  onSelect: (variable: string) => void;
}

export function MessageVariables({ onSelect }: MessageVariablesProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <Clock className="h-4 w-4" />
          Variáveis de tempo
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-popover z-50">
        <DropdownMenuLabel>Variáveis disponíveis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => onSelect("{{nome}}")}>
          <User className="mr-2 h-4 w-4" />
          Nome do contato
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => onSelect("{{telefone}}")}>
          <User className="mr-2 h-4 w-4" />
          Telefone do contato
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Campos personalizados serão carregados da lista
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
