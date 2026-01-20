import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SimpleDispatchContact {
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  message_sent_at: string | null;
  message_status: string;
  response_message: string | null;
  response_received_at: string | null;
  has_response: boolean;
}

export function useSimpleDispatchReport(campaignId: string) {
  return useQuery({
    queryKey: ["simple-dispatch-report", campaignId],
    queryFn: async () => {
      // Buscar todas as mensagens da campanha com dados de contato
      const { data: messages, error: messagesError } = await supabase
        .from("campaign_messages")
        .select(`
          id,
          contact_id,
          sent_at,
          status,
          contacts (
            id,
            name,
            phone
          )
        `)
        .eq("campaign_id", campaignId)
        .order("sent_at", { ascending: true });

      if (messagesError) throw messagesError;

      // Buscar todas as respostas da campanha
      const { data: responses, error: responsesError } = await supabase
        .from("contact_responses")
        .select("contact_id, phone, message_text, received_at")
        .eq("campaign_id", campaignId);

      if (responsesError) throw responsesError;

      console.log(`📊 [Simple Dispatch] Campanha: ${campaignId}`);
      console.log(`   - Total de mensagens: ${messages?.length || 0}`);
      console.log(`   - Total de respostas brutas: ${responses?.length || 0}`);

      // Combinar dados (agrupar por contato para evitar duplicatas)
      const contactsMap = new Map<string, SimpleDispatchContact>();
      let validResponsesCount = 0;
      
      messages?.forEach(msg => {
        const contact = msg.contacts;
        if (!contact || !msg.sent_at) return;

        // ✅ FILTRO: Buscar APENAS respostas recebidas APÓS o envio desta mensagem
        const validResponse = responses?.find(r => {
          const matchesContact = r.contact_id === contact.id || r.phone === contact.phone;
          const receivedAfterSent = r.received_at && new Date(r.received_at) > new Date(msg.sent_at);
          return matchesContact && receivedAfterSent;
        });

        if (validResponse) {
          validResponsesCount++;
        }

        const contactData: SimpleDispatchContact = {
          contact_id: contact.id,
          contact_name: contact.name,
          contact_phone: contact.phone,
          message_sent_at: msg.sent_at,
          message_status: msg.status,
          response_message: validResponse?.message_text || null,
          response_received_at: validResponse?.received_at || null,
          has_response: !!validResponse,
        };

        // Se já existe, manter a primeira mensagem (ordem cronológica)
        if (!contactsMap.has(contact.id)) {
          contactsMap.set(contact.id, contactData);
        }
      });

      console.log(`   - Respostas válidas (após filtro de data): ${validResponsesCount}`);

      return Array.from(contactsMap.values());
    },
    enabled: !!campaignId,
  });
}
