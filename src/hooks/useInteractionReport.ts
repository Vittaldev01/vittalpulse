import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InteractionContact {
  id: string;
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  current_stage: string;
  message1_sent_at: string | null;
  message1_response_received_at: string | null;
  message2_sent_at: string | null;
  message2_response_received_at: string | null;
  followup_started: boolean;
  flow_completed: boolean;
}

export interface InteractionStats {
  total: number;
  respondedM1: number;
  receivedM2: number;
  respondedM2: number;
  inFollowup: number;
  completed: number;
}

export const useInteractionReport = (campaignId: string) => {
  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["interaction-report", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_interaction_status")
        .select(`
          id,
          contact_id,
          current_stage,
          message1_sent_at,
          message1_response_received_at,
          message2_sent_at,
          message2_response_received_at,
          followup_started,
          flow_completed,
          contacts!inner (
            id,
            name,
            phone
          )
        `)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((item) => {
        const contact = item.contacts as any;
        return {
          id: item.id,
          contact_id: item.contact_id,
          contact_name: contact.name || "Desconhecido",
          contact_phone: contact.phone || "",
          current_stage: item.current_stage,
          message1_sent_at: item.message1_sent_at,
          message1_response_received_at: item.message1_response_received_at,
          message2_sent_at: item.message2_sent_at,
          message2_response_received_at: item.message2_response_received_at,
          followup_started: item.followup_started || false,
          flow_completed: item.flow_completed || false,
        } as InteractionContact;
      });
    },
    enabled: !!campaignId,
  });

  // Calcular estatísticas
  const stats: InteractionStats = {
    total: contacts?.length || 0,
    respondedM1: contacts?.filter((c) => c.message1_response_received_at !== null).length || 0,
    receivedM2: contacts?.filter((c) => c.message2_sent_at !== null).length || 0,
    respondedM2: contacts?.filter((c) => c.message2_response_received_at !== null).length || 0,
    inFollowup: contacts?.filter((c) => c.followup_started).length || 0,
    completed: contacts?.filter((c) => c.flow_completed).length || 0,
  };

  return {
    contacts: contacts || [],
    stats,
    isLoading: contactsLoading,
  };
};
