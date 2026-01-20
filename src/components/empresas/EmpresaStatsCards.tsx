import { Building2, Users, Smartphone, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useEmpresasStats } from "@/hooks/useEmpresas";
import { Skeleton } from "@/components/ui/skeleton";

export const EmpresaStatsCards = () => {
  const { data: stats, isLoading } = useEmpresasStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Empresas Ativas",
      value: stats?.active_companies || 0,
      icon: Building2,
      color: "text-primary",
    },
    {
      title: "Usuários Total",
      value: stats?.total_users || 0,
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Chips Conectados",
      value: stats?.connected_chips || 0,
      icon: Smartphone,
      color: "text-green-500",
    },
    {
      title: "Disparos do Mês",
      value: stats?.total_dispatches || 0,
      icon: Send,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-3xl font-bold mt-2">{card.value.toLocaleString()}</p>
              </div>
              <card.icon className={`h-10 w-10 ${card.color}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
