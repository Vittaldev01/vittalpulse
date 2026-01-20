import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CampaignMessage {
  id: string;
  campaign_id: string;
  contact_id: string;
  message_text: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  media_url: string | null;
  part1_variation: number | null;
  part2_variation: number | null;
  contacts: {
    name: string;
    phone: string;
  };
  whatsapp_connections?: {
    id: string;
    name: string;
    instance_id: string;
  } | null;
}

export interface CampaignDetailsData {
  id: string;
  name: string;
  status: string;
  pause_reason: string | null;
  campaign_type: string | null;
  total_messages: number;
  sent_messages: number;
  failed_messages: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  scheduled_at: string | null;
  min_interval_seconds: number;
  max_interval_seconds: number;
  pause_after_messages: number;
  pause_duration_minutes: number;
  allowed_hours_start: string;
  allowed_hours_end: string;
  allowed_days: string;
  messages: string;
  whatsapp_connections: {
    name: string;
  };
  contact_lists: {
    name: string;
  };
}

export const useCampaignDetails = (campaignId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar detalhes da campanha
  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select(`
          *,
          whatsapp_connections(name),
          contact_lists(name)
        `)
        .eq("id", campaignId)
        .single();

      if (error) throw error;
      return data as CampaignDetailsData;
    },
    enabled: !!campaignId,
  });

  // Buscar mensagens da campanha
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["campaign-messages", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_messages")
        .select(`
          *,
          contacts(
            name, 
            phone, 
            preferred_connection_id,
            whatsapp_connections!preferred_connection_id(id, name)
          ),
          whatsapp_connections!used_connection_id(id, name, instance_id)
        `)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CampaignMessage[];
    },
    enabled: !!campaignId,
  });

  // Buscar contagem de respostas
  const { data: responsesCount, isLoading: responsesLoading } = useQuery({
    queryKey: ["campaign-responses-count", campaignId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("contact_responses")
        .select("*", { count: 'exact', head: true })
        .eq("campaign_id", campaignId);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!campaignId,
  });

  // Verificar se campanha tem follow-up
  const { data: hasFollowUp, isLoading: followUpLoading } = useQuery({
    queryKey: ["campaign-has-followup", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follow_up_flows")
        .select("id, is_active")
        .eq("campaign_id", campaignId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!campaignId,
  });

  // Estatísticas agregadas
  const stats = {
    pending: messages?.filter(m => m.status === 'pending').length || 0,
    sent: messages?.filter(m => m.status === 'sent').length || 0,
    failed: messages?.filter(m => m.status === 'failed').length || 0,
  };

  // Dados para gráfico de linha (mensagens por hora)
  const messagesByHour = messages?.reduce((acc: any, msg) => {
    if (msg.sent_at) {
      const hour = new Date(msg.sent_at).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
    }
    return acc;
  }, {});

  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, '0')}:00`,
    messages: messagesByHour?.[i] || 0,
  }));

  // Iniciar campanha
  const startCampaign = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-campaign', {
        body: { campaign_id: campaignId },
      });

      if (error) throw error;
      return data;
    },
    onMutate: async () => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ["campaign", campaignId] });
      
      // Pegar valor anterior
      const previousCampaign = queryClient.getQueryData(["campaign", campaignId]);
      
      // Atualização otimista
      queryClient.setQueryData(["campaign", campaignId], (old: any) => ({
        ...old,
        status: "running",
      }));
      
      return { previousCampaign };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-messages", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Campanha iniciada!",
        description: "As mensagens começarão a ser enviadas em breve.",
      });
    },
    onError: (error: Error, variables, context: any) => {
      // Reverter para valor anterior em caso de erro
      if (context?.previousCampaign) {
        queryClient.setQueryData(["campaign", campaignId], context.previousCampaign);
      }
      toast({
        title: "Erro ao iniciar campanha",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Pausar campanha
  const pauseCampaign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: "paused" })
        .eq("id", campaignId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Campanha pausada",
        description: "Os envios foram pausados.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao pausar campanha",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Retomar campanha
  const resumeCampaign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: "running" })
        .eq("id", campaignId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Campanha retomada",
        description: "Os envios foram retomados.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao retomar campanha",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancelar campanha
  const cancelCampaign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: "cancelled" })
        .eq("id", campaignId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Campanha cancelada",
        description: "A campanha foi cancelada.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cancelar campanha",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Enviar próxima mensagem manualmente
  const sendNextMessage = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-campaign-messages');
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-messages", campaignId] });
      toast({
        title: "Processando envio",
        description: "A próxima mensagem será enviada em instantes.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Buscar conexões da campanha
  const { data: campaignConnections } = useQuery({
    queryKey: ["campaign-connections", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_connections")
        .select(`
          connection_id,
          whatsapp_connections(id, name, status)
        `)
        .eq("campaign_id", campaignId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  // Verificar chips desconectados
  const disconnectedChips = campaignConnections?.filter(
    (cc: any) => cc.whatsapp_connections?.status !== 'connected'
  );
  const hasDisconnectedChip = disconnectedChips && disconnectedChips.length > 0;

  // Retomar após reconexão
  const resumeAfterReconnection = useMutation({
    mutationFn: async () => {
      // 1. Resetar mensagens falhadas para 'pending'
      await supabase
        .from('campaign_messages')
        .update({ status: 'pending', error_message: null })
        .eq('campaign_id', campaignId)
        .eq('status', 'failed');
      
      // 2. Atualizar campanha para running e limpar motivo
      await supabase
        .from('campaigns')
        .update({ 
          status: 'running',
          pause_reason: null 
        })
        .eq('id', campaignId);
      
      // 3. Invocar edge function para continuar envio
      await supabase.functions.invoke('send-campaign-messages');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-messages", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-connections", campaignId] });
      toast({
        title: "Envio retomado!",
        description: "As mensagens falhadas serão reenviadas.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao retomar envio",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    campaign,
    messages,
    stats,
    hourlyData,
    responsesCount: responsesCount || 0,
    hasFollowUp: hasFollowUp || false,
    isLoading: campaignLoading || messagesLoading || responsesLoading || followUpLoading,
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    cancelCampaign,
    sendNextMessage,
    campaignConnections,
    disconnectedChips,
    hasDisconnectedChip,
    resumeAfterReconnection,
  };
};
