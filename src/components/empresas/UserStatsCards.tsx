import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserPlus, TrendingUp } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserStatsCardsProps {
  users: any[];
}

export const UserStatsCards = ({ users }: UserStatsCardsProps) => {
  const stats = useMemo(() => {
    if (!users || users.length === 0) {
      return {
        total: 0,
        newThisMonth: 0,
        approved: 0,
        approvalRate: 0,
        monthlySignups: [],
      };
    }

    // Total de usuários
    const total = users.length;

    // Usuários aprovados
    const approved = users.filter((u) => u.approved).length;

    // Taxa de aprovação
    const approvalRate = total > 0 ? (approved / total) * 100 : 0;

    // Novos cadastros no mês atual
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    const newThisMonth = users.filter((u) => {
      if (!u.created_at) return false;
      const createdDate = new Date(u.created_at);
      return isWithinInterval(createdDate, { start: monthStart, end: monthEnd });
    }).length;

    // Novos cadastros por mês (últimos 6 meses)
    const monthlySignups = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      
      const count = users.filter((u) => {
        if (!u.created_at) return false;
        const createdDate = new Date(u.created_at);
        return isWithinInterval(createdDate, { start, end });
      }).length;

      monthlySignups.push({
        month: format(monthDate, "MMM", { locale: ptBR }),
        count,
      });
    }

    return {
      total,
      newThisMonth,
      approved,
      approvalRate,
      monthlySignups,
    };
  }, [users]);

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Cadastrados no sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos Este Mês</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              Cadastros em {format(new Date(), "MMMM", { locale: ptBR })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Aprovação</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvalRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.approved} de {stats.total} aprovados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">
              Aprovados e com acesso
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Signups Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Novos Cadastros por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.monthlySignups.map((month) => {
              const maxCount = Math.max(...stats.monthlySignups.map((m) => m.count), 1);
              const percentage = (month.count / maxCount) * 100;

              return (
                <div key={month.month} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{month.month}</span>
                    <span className="text-muted-foreground">{month.count} usuários</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
