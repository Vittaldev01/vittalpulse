import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConnectionHealth {
  id: string;
  name: string;
  status: string;
  phone_number: string | null;
  instance_id: string | null;
  connected_at: string | null;
  last_error: string | null;
  
  // Estatísticas calculadas
  total_messages: number;
  sent_messages: number;
  failed_messages: number;
  success_rate: number;
  failure_rate: number;
  last_activity: string | null;
  messages_today: number;
  errors_last_hour: number;
  
  // Status de saúde
  health_status: 'healthy' | 'warning' | 'critical' | 'inactive';
  health_issues: string[];
}

export const useConnectionHealth = () => {
  return useQuery({
    queryKey: ["connection-health"],
    queryFn: async () => {
      // Buscar todas as conexões
      const { data: connections, error: connectionsError } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .order("created_at", { ascending: false });

      if (connectionsError) throw connectionsError;

      // Para cada conexão, buscar estatísticas de mensagens
      const healthData: ConnectionHealth[] = await Promise.all(
        connections.map(async (conn) => {
          // Total de mensagens desta conexão
          const { count: totalCount } = await supabase
            .from("campaign_messages")
            .select("*", { count: "exact", head: true })
            .eq("used_connection_id", conn.id);

          // Mensagens enviadas
          const { count: sentCount } = await supabase
            .from("campaign_messages")
            .select("*", { count: "exact", head: true })
            .eq("used_connection_id", conn.id)
            .eq("status", "sent");

          // Mensagens falhadas
          const { count: failedCount } = await supabase
            .from("campaign_messages")
            .select("*", { count: "exact", head: true })
            .eq("used_connection_id", conn.id)
            .eq("status", "failed");

          // Última atividade
          const { data: lastMessage } = await supabase
            .from("campaign_messages")
            .select("sent_at")
            .eq("used_connection_id", conn.id)
            .not("sent_at", "is", null)
            .order("sent_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Mensagens enviadas hoje
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const { count: todayCount } = await supabase
            .from("campaign_messages")
            .select("*", { count: "exact", head: true })
            .eq("used_connection_id", conn.id)
            .eq("status", "sent")
            .gte("sent_at", todayStart.toISOString());

          // Erros na última hora
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const { count: recentErrors } = await supabase
            .from("campaign_messages")
            .select("*", { count: "exact", head: true })
            .eq("used_connection_id", conn.id)
            .eq("status", "failed")
            .gte("created_at", oneHourAgo.toISOString());

          const total = totalCount || 0;
          const sent = sentCount || 0;
          const failed = failedCount || 0;
          const today = todayCount || 0;
          const errorsLastHour = recentErrors || 0;

          const successRate = total > 0 ? (sent / total) * 100 : 0;
          const failureRate = total > 0 ? (failed / total) * 100 : 0;

          // Determinar status de saúde
          const healthIssues: string[] = [];
          let healthStatus: ConnectionHealth["health_status"] = "healthy";

          if (conn.status !== "connected") {
            healthIssues.push("Conexão desconectada");
            healthStatus = "critical";
          } else if (errorsLastHour > 5) {
            healthIssues.push(`${errorsLastHour} erros na última hora`);
            healthStatus = "critical";
          } else if (failureRate > 20 && total > 10) {
            healthIssues.push(`Taxa de falha alta: ${failureRate.toFixed(1)}%`);
            healthStatus = "warning";
          } else if (failureRate > 10 && total > 10) {
            healthIssues.push(`Taxa de falha moderada: ${failureRate.toFixed(1)}%`);
            healthStatus = "warning";
          } else if (total === 0) {
            healthIssues.push("Nenhuma mensagem enviada ainda");
            healthStatus = "inactive";
          }

          if (conn.last_error) {
            healthIssues.push(`Último erro: ${conn.last_error}`);
            if (healthStatus === "healthy") healthStatus = "warning";
          }

          return {
            id: conn.id,
            name: conn.name,
            status: conn.status || "pending",
            phone_number: conn.phone_number,
            instance_id: conn.instance_id,
            connected_at: conn.connected_at,
            last_error: conn.last_error,
            total_messages: total,
            sent_messages: sent,
            failed_messages: failed,
            success_rate: successRate,
            failure_rate: failureRate,
            last_activity: lastMessage?.sent_at || null,
            messages_today: today,
            errors_last_hour: errorsLastHour,
            health_status: healthStatus,
            health_issues: healthIssues,
          };
        })
      );

      return healthData;
    },
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });
};
