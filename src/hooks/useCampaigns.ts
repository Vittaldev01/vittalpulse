import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Campaign {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "running" | "paused" | "completed" | "cancelled";
  total_messages: number;
  sent_messages: number;
  failed_messages: number;
  created_at: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  responses_count: number;
  campaign_type?: "simple" | "interactive" | null;
  has_follow_up?: boolean;
}

export interface CampaignFormData {
  name: string;
  connection_id: string;
  list_id: string;
  messages?: string;
  template_id?: string;
  min_interval_seconds: number;
  max_interval_seconds: number;
  pause_after_messages: number;
  pause_duration_minutes: number;
  allowed_hours_start: string;
  allowed_hours_end: string;
  allowed_days: string[];
  scheduled_at?: string;
}

export const useCampaigns = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data: campaignsData, error } = await supabase
        .from("campaigns")
        .select(`
          *,
          follow_up_flows:follow_up_flows(id, is_active)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar contagem de respostas para cada campanha
      const campaignsWithResponses = await Promise.all(
        (campaignsData || []).map(async (campaign) => {
          const { count } = await supabase
            .from("contact_responses")
            .select("*", { count: 'exact', head: true })
            .eq("campaign_id", campaign.id);

          return {
            ...campaign,
            responses_count: count || 0,
            has_follow_up: campaign.follow_up_flows && campaign.follow_up_flows.length > 0,
          };
        })
      );

      return campaignsWithResponses as Campaign[];
    },
  });

  const createCampaign = useMutation({
    mutationFn: async (campaignData: CampaignFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar empresa_id do usuário
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("campaigns")
        .insert([
          {
            user_id: user.id,
            empresa_id: profile?.empresa_id || null,
            ...campaignData,
            allowed_days: JSON.stringify(campaignData.allowed_days),
            status: "running", // Inicia direto como running
          },
        ])
        .select()
        .single();

      if (error) throw error;
      
      // Processar campanha imediatamente
      const { error: processError } = await supabase.functions.invoke('process-campaign', {
        body: { campaign_id: data.id },
      });
      
      if (processError) throw processError;
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Campanha iniciada!",
        description: "Sua campanha foi criada e iniciada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar campanha",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCampaignStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("campaigns")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Status atualizado!",
        description: "O status da campanha foi atualizado.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const duplicateCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar campanha original
      const { data: original, error: fetchError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();

      if (fetchError) throw fetchError;

      // Criar cópia
      const { data, error } = await supabase
        .from("campaigns")
        .insert([
          {
            user_id: user.id,
            empresa_id: original.empresa_id,
            name: `${original.name} (cópia)`,
            campaign_type: original.campaign_type || 'simple',
            interaction_config: original.interaction_config || null,
            connection_id: original.connection_id,
            list_id: original.list_id,
            messages: original.messages,
            min_interval_seconds: original.min_interval_seconds,
            max_interval_seconds: original.max_interval_seconds,
            pause_after_messages: original.pause_after_messages,
            pause_duration_minutes: original.pause_duration_minutes,
            allowed_hours_start: original.allowed_hours_start,
            allowed_hours_end: original.allowed_hours_end,
            allowed_days: typeof original.allowed_days === 'string' 
              ? original.allowed_days 
              : JSON.stringify(original.allowed_days), // Garantir formato JSON
            status: "draft",
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Campanha duplicada!",
        description: "A campanha foi duplicada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao duplicar campanha",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-sent-messages"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-responses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-daily-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-recent-campaigns"] });
      toast({
        title: "Campanha deletada!",
        description: "A campanha e todos os seus dados foram removidos.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao deletar campanha",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    campaigns: campaigns || [],
    isLoading,
    createCampaign,
    updateCampaignStatus,
    duplicateCampaign,
    deleteCampaign,
  };
};
