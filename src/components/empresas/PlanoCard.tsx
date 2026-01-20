import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Send, Smartphone, Users, Megaphone, Building2 } from "lucide-react";
import { useEmpresas } from "@/hooks/useEmpresas";

interface PlanoCardProps {
  plano: any;
  onEdit: () => void;
}

export const PlanoCard = ({ plano, onEdit }: PlanoCardProps) => {
  const { data: empresas } = useEmpresas();
  
  // Count how many companies use this plan
  const companiesUsingPlan = empresas?.filter(
    (empresa) => empresa.plano_nome === plano.nome
  ).length || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {plano.nome}
            </CardTitle>
            <p className="text-2xl font-bold mt-2 text-primary">
              {formatCurrency(plano.preco_mensal)}<span className="text-sm font-normal text-muted-foreground">/mês</span>
            </p>
          </div>
          {plano.is_active ? (
            <Badge className="bg-green-500">Ativo</Badge>
          ) : (
            <Badge variant="secondary">Inativo</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{plano.descricao}</p>
        
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-muted-foreground" />
              <span>Disparos/mês</span>
            </div>
            <span className="font-semibold">{plano.limite_disparos_mensal.toLocaleString()}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span>Conexões</span>
            </div>
            <span className="font-semibold">{plano.limite_conexoes}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Contatos</span>
            </div>
            <span className="font-semibold">{plano.limite_contatos.toLocaleString()}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-muted-foreground" />
              <span>Campanhas simultâneas</span>
            </div>
            <span className="font-semibold">{plano.limite_campanhas_simultaneas}</span>
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{companiesUsingPlan} {companiesUsingPlan === 1 ? 'empresa usa' : 'empresas usam'}</span>
            </div>
          </div>
          <Button onClick={onEdit} variant="outline" className="w-full">
            Editar Plano
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
