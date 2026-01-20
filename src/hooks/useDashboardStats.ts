import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  totalSent: number;
  totalResponses: number;
  responseRate: number;
  activeConnections: number;
  sentChange: string;
  responsesChange: string;
  rateChange: string;
}

interface InteractiveStats {
  m1Responses: number;
  m2Responses: number;
}

interface DailyStats {
  date: string;
  count: number;
}

interface RecentCampaign {
  id: string;
  name: string;
  progress: number;
  sent: number;
  total: number;
}

export function useDashboardStats(dateRange?: { start: Date; end: Date }) {
  // Query 1: Total de mensagens enviadas
  const { data: sentMessages } = useQuery({
    queryKey: ["dashboard-sent-messages", dateRange],
    queryFn: async () => {
      let query = supabase
        .from("campaign_messages")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent");
      
      if (dateRange) {
        query = query
          .gte("sent_at", dateRange.start.toISOString())
          .lte("sent_at", dateRange.end.toISOString());
      }
      
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  // Query 2: Total de respostas únicas (simple campaigns)
  const { data: simpleResponses } = useQuery({
    queryKey: ["dashboard-simple-responses", dateRange],
    queryFn: async () => {
      let query = supabase
        .from("contact_responses")
        .select("contact_id, campaigns!inner(campaign_type)");
      
      if (dateRange) {
        query = query
          .gte("received_at", dateRange.start.toISOString())
          .lte("received_at", dateRange.end.toISOString());
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Contar apenas contact_id únicos de campanhas simples
      const uniqueContacts = new Set(
        data?.filter(r => r.campaigns?.campaign_type === 'simple' || !r.campaigns?.campaign_type)
          .map(r => r.contact_id)
      );
      return uniqueContacts.size;
    },
  });

  // Query 2b: Respostas M1 de campanhas interativas
  const { data: m1Responses } = useQuery({
    queryKey: ["dashboard-m1-responses", dateRange],
    queryFn: async () => {
      let query = supabase
        .from("contact_interaction_status")
        .select("contact_id, message1_response_received_at")
        .not("message1_response_received_at", "is", null);
      
      if (dateRange) {
        query = query
          .gte("message1_response_received_at", dateRange.start.toISOString())
          .lte("message1_response_received_at", dateRange.end.toISOString());
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data?.length || 0;
    },
  });

  // Query 2c: Respostas M2 de campanhas interativas
  const { data: m2Responses } = useQuery({
    queryKey: ["dashboard-m2-responses", dateRange],
    queryFn: async () => {
      let query = supabase
        .from("contact_interaction_status")
        .select("contact_id, message2_response_received_at")
        .not("message2_response_received_at", "is", null);
      
      if (dateRange) {
        query = query
          .gte("message2_response_received_at", dateRange.start.toISOString())
          .lte("message2_response_received_at", dateRange.end.toISOString());
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data?.length || 0;
    },
  });

  // Query 3: Conexões ativas
  const { data: activeConnections } = useQuery({
    queryKey: ["dashboard-connections"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("whatsapp_connections")
        .select("*", { count: "exact", head: true })
        .eq("status", "connected");
      
      if (error) throw error;
      return count || 0;
    },
  });

  // Query 4: Disparos por dia
  const { data: dailyStats } = useQuery({
    queryKey: ["dashboard-daily-stats", dateRange],
    queryFn: async () => {
      const startDate = dateRange?.start || (() => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return sevenDaysAgo;
      })();
      
      const endDate = dateRange?.end || new Date();

      const { data, error } = await supabase
        .from("campaign_messages")
        .select("sent_at")
        .eq("status", "sent")
        .gte("sent_at", startDate.toISOString())
        .lte("sent_at", endDate.toISOString())
        .order("sent_at", { ascending: true });
      
      if (error) throw error;

      // Agrupar por dia
      const grouped: Record<string, number> = {};
      data?.forEach((msg) => {
        const date = new Date(msg.sent_at!).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        });
        grouped[date] = (grouped[date] || 0) + 1;
      });

      return Object.entries(grouped).map(([date, count]) => ({
        date,
        count,
      }));
    },
  });

  // Query 5: Campanhas recentes (últimas 3)
  const { data: recentCampaigns } = useQuery({
    queryKey: ["dashboard-recent-campaigns", dateRange],
    queryFn: async () => {
      let query = supabase
        .from("campaigns")
        .select("id, name, total_messages, sent_messages")
        .order("started_at", { ascending: false })
        .limit(3);
      
      if (dateRange) {
        query = query
          .gte("started_at", dateRange.start.toISOString())
          .lte("started_at", dateRange.end.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) throw error;

      return data?.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        progress: campaign.total_messages && campaign.total_messages > 0 
          ? Math.round(((campaign.sent_messages || 0) / campaign.total_messages) * 100)
          : 0,
        sent: campaign.sent_messages || 0,
        total: campaign.total_messages || 0,
      })) || [];
    },
  });

  // Calcular estatísticas
  const totalResponses = (simpleResponses || 0) + (m1Responses || 0) + (m2Responses || 0);
  
  const stats: DashboardStats = {
    totalSent: sentMessages || 0,
    totalResponses,
    responseRate: sentMessages && sentMessages > 0 
      ? (totalResponses / sentMessages) * 100 
      : 0,
    activeConnections: activeConnections || 0,
    sentChange: "+18.2%",
    responsesChange: "+12.5%",
    rateChange: "+5.1%",
  };

  return {
    stats,
    dailyStats: dailyStats || [],
    recentCampaigns: recentCampaigns || [],
    interactiveStats: {
      m1Responses: m1Responses || 0,
      m2Responses: m2Responses || 0,
    },
    isLoading: false,
  };
}
