import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FollowUpContact {
  id: string;
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  current_step: number;
  is_active: boolean;
  next_message_at: string | null;
  last_message_sent_at: string | null;
  stopped_reason: string | null;
  stopped_at: string | null;
  created_at?: string;
  response_message: string | null;
  response_received_at: string | null;
  used_connection_name: string | null;
}

export function useFollowUpStatus(campaignId: string) {
  const queryClient = useQueryClient();

  const { data: followUpContacts, isLoading } = useQuery({
    queryKey: ["follow-up-status", campaignId],
    queryFn: async () => {
      // Buscar o flow_id da campanha
      const { data: flows, error: flowError } = await supabase
        .from("follow_up_flows")
        .select("id")
        .eq("campaign_id", campaignId)
        .maybeSingle();

      if (flowError) throw flowError;
      if (!flows) return [];

      // Buscar status de follow-up com joins (APENAS ATIVOS)
      const { data, error } = await supabase
        .from("contact_follow_up_status")
        .select(`
          id,
          contact_id,
          current_step,
          is_active,
          next_message_at,
          last_message_sent_at,
          stopped_reason,
          stopped_at,
          created_at,
          contacts (
            name,
            phone
          )
        `)
        .eq("flow_id", flows.id)
        .eq("is_active", true)
        .order("current_step", { ascending: false });

      if (error) throw error;

      // ✅ FILTRO: Buscar APENAS respostas desta campanha
      const contactIds = data?.map((s) => s.contact_id) || [];
      const phones = data?.map((s) => (s.contacts as any)?.phone).filter(Boolean) || [];
      
      const { data: responses } = await supabase
        .from("contact_responses")
        .select("contact_id, phone, message_text, received_at, campaign_id")
        .eq("campaign_id", campaignId)
        .in("contact_id", contactIds)
        .order("received_at", { ascending: false });

      // Buscar respostas por telefone como fallback para duplicados
      const { data: responsesByPhone } = await supabase
        .from("contact_responses")
        .select("contact_id, phone, message_text, received_at, campaign_id")
        .eq("campaign_id", campaignId)
        .in("phone", phones)
        .order("received_at", { ascending: false });

      // Buscar qual chip foi usado para enviar mensagens de cada contato
      const { data: lastMessages } = await supabase
        .from("campaign_messages")
        .select(`
          contact_id,
          used_connection_id,
          whatsapp_connections!inner (
            name
          )
        `)
        .in("contact_id", contactIds)
        .eq("status", "sent")
        .order("sent_at", { ascending: false });

      // ✅ LOGGING
      console.log(`📊 [Follow-up Status] Campanha: ${campaignId}`);
      console.log(`   - Total de leads: ${data?.length || 0}`);
      console.log(`   - Respostas brutas encontradas: ${responses?.length || 0}`);
      console.log(`   - Respostas por telefone: ${responsesByPhone?.length || 0}`);

      // Mapear dados
      return (data || []).map((status) => {
        const contact = status.contacts as any;
        const contactPhone = contact?.phone || "";
        
        // Tentar encontrar resposta por contact_id primeiro
        let response = responses?.find((r) => r.contact_id === status.contact_id);
        
        // Se não encontrou, buscar por telefone (fallback para duplicados)
        if (!response && contactPhone) {
          response = responsesByPhone?.find((r) => r.phone === contactPhone);
        }

        // Buscar qual chip foi usado
        const lastMessage = lastMessages?.find((m) => m.contact_id === status.contact_id);
        const connectionName = (lastMessage?.whatsapp_connections as any)?.name || null;

        // ✅ VALIDAÇÃO: Resposta só é válida se recebida APÓS início do follow-up
        let validResponse = response;
        if (response && status.created_at) {
          const responseDate = new Date(response.received_at);
          const followUpStartDate = new Date(status.created_at);
          
          // Se resposta foi ANTES do follow-up começar, ignorar
          if (responseDate <= followUpStartDate) {
            console.log(`⚠️  Resposta ignorada para ${contact?.name}: recebida antes do follow-up`);
            validResponse = null;
          }
        }

        return {
          id: status.id,
          contact_id: status.contact_id,
          contact_name: contact?.name || "Desconhecido",
          contact_phone: contact?.phone || "",
          current_step: status.current_step || 0,
          is_active: status.is_active || false,
          next_message_at: status.next_message_at,
          last_message_sent_at: status.last_message_sent_at,
          stopped_reason: status.stopped_reason,
          stopped_at: status.stopped_at,
          created_at: status.created_at,
          response_message: validResponse?.message_text || null,
          response_received_at: validResponse?.received_at || null,
          used_connection_name: connectionName,
        } as FollowUpContact;
      });
    },
    enabled: !!campaignId,
  });

  const updateNextMessageDate = useMutation({
    mutationFn: async ({
      statusId,
      newDate,
    }: {
      statusId: string;
      newDate: string;
    }) => {
      const { error } = await supabase
        .from("contact_follow_up_status")
        .update({ next_message_at: newDate })
        .eq("id", statusId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-up-status", campaignId] });
      toast.success("Data de próximo envio atualizada!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar data:", error);
      toast.error("Erro ao atualizar data de envio");
    },
  });

  const initializeFollowUpStatus = useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "initialize-follow-up-status",
        {
          body: { campaign_id: campaignId },
        }
      );

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.message || data.error || "Erro ao inicializar follow-ups");
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["follow-up-status", campaignId] });
      toast.success(data.message || `${data.created} follow-ups inicializados!`);
    },
    onError: (error: any) => {
      console.error("Erro ao inicializar follow-ups:", error);
      toast.error(error.message || "Erro ao inicializar follow-ups");
    },
  });

  return {
    followUpContacts: followUpContacts || [],
    isLoading,
    updateNextMessageDate,
    initializeFollowUpStatus,
  };
}
