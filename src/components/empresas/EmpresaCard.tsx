import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Building2, Users, Smartphone, MessageSquare, Edit, Eye, PauseCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EmpresaCardProps {
  empresa: any;
  onEdit: () => void;
}

export const EmpresaCard = ({ empresa, onEdit }: EmpresaCardProps) => {
  const navigate = useNavigate();

  const usagePercentage = empresa.limite_disparos_mensal > 0
    ? (empresa.disparos_usados_mes_atual / empresa.limite_disparos_mensal) * 100
    : 0;

  const getStatusBadge = () => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      ativo: { label: "Ativo", variant: "default" },
      trial: { label: "Trial", variant: "secondary" },
      suspenso: { label: "Suspenso", variant: "destructive" },
      cancelado: { label: "Cancelado", variant: "outline" },
    };
    const status = statusMap[empresa.status] || statusMap.ativo;
    return <Badge variant={status.variant}>{status.label}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">{empresa.nome}</CardTitle>
              <p className="text-sm text-muted-foreground">{empresa.email_contato}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <Badge variant="outline">{empresa.plano_nome}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Disparos */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Disparos</span>
            <span className="font-medium">
              {empresa.disparos_usados_mes_atual.toLocaleString()} / {empresa.limite_disparos_mensal.toLocaleString()}
            </span>
          </div>
          <Progress value={usagePercentage} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">{usagePercentage.toFixed(1)}% usado</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Conexões</p>
              <p className="font-medium">{empresa.connections_count} / {empresa.limite_conexoes}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Contatos</p>
              <p className="font-medium">{empresa.contacts_count.toLocaleString()} / {empresa.limite_contatos.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Campanhas</p>
              <p className="font-medium">{empresa.active_campaigns_count} / {empresa.limite_campanhas_simultaneas}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Usuários</p>
              <p className="font-medium">{empresa.users_count}</p>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
          <Edit className="h-4 w-4" />
          Editar
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-2">
          <Eye className="h-4 w-4" />
          Ver Dashboard
        </Button>
        {empresa.status === "ativo" && (
          <Button variant="outline" size="sm" className="gap-2">
            <PauseCircle className="h-4 w-4" />
            Suspender
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
