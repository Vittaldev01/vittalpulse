import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Lista de estados brasileiros com nomes completos e siglas
const BRAZILIAN_STATES: { name: string; abbr: string }[] = [
  { name: 'ACRE', abbr: 'AC' },
  { name: 'ALAGOAS', abbr: 'AL' },
  { name: 'AMAPÁ', abbr: 'AP' },
  { name: 'AMAZONAS', abbr: 'AM' },
  { name: 'BAHIA', abbr: 'BA' },
  { name: 'CEARÁ', abbr: 'CE' },
  { name: 'DISTRITO FEDERAL', abbr: 'DF' },
  { name: 'ESPÍRITO SANTO', abbr: 'ES' },
  { name: 'GOIÁS', abbr: 'GO' },
  { name: 'MARANHÃO', abbr: 'MA' },
  { name: 'MATO GROSSO', abbr: 'MT' },
  { name: 'MATO GROSSO DO SUL', abbr: 'MS' },
  { name: 'MINAS GERAIS', abbr: 'MG' },
  { name: 'PARÁ', abbr: 'PA' },
  { name: 'PARAÍBA', abbr: 'PB' },
  { name: 'PARANÁ', abbr: 'PR' },
  { name: 'PERNAMBUCO', abbr: 'PE' },
  { name: 'PIAUÍ', abbr: 'PI' },
  { name: 'RIO DE JANEIRO', abbr: 'RJ' },
  { name: 'RIO GRANDE DO NORTE', abbr: 'RN' },
  { name: 'RIO GRANDE DO SUL', abbr: 'RS' },
  { name: 'RONDÔNIA', abbr: 'RO' },
  { name: 'RORAIMA', abbr: 'RR' },
  { name: 'SANTA CATARINA', abbr: 'SC' },
  { name: 'SÃO PAULO', abbr: 'SP' },
  { name: 'SERGIPE', abbr: 'SE' },
  { name: 'TOCANTINS', abbr: 'TO' },
];

export interface StateMetric {
  state: string;
  stateAbbr: string;
  totalContacts: number;
  uniqueDispatches: number;
  responses: number;
  campaignCount: number;
  responseRate: number;
}

function extractStatesFromCampaigns(campaignNames: string[]): { name: string; abbr: string }[] {
  const foundStates = new Map<string, { name: string; abbr: string }>();

  for (const campaignName of campaignNames) {
    const upperName = campaignName.toUpperCase();

    for (const state of BRAZILIAN_STATES) {
      // Verifica nome completo do estado
      if (upperName.includes(state.name)) {
        foundStates.set(state.name, state);
      }
    }
  }

  return Array.from(foundStates.values());
}

export function useStateMetrics(dateRange?: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ["state-metrics", dateRange],
    queryFn: async () => {
      // 1. Buscar todas as campanhas
      const { data: campaigns, error: campaignsError } = await supabase
        .from("campaigns")
        .select("id, name");

      if (campaignsError) throw campaignsError;
      if (!campaigns || campaigns.length === 0) return [];

      // 2. Extrair estados encontrados nos nomes das campanhas
      const campaignNames = campaigns.map(c => c.name);
      const foundStates = extractStatesFromCampaigns(campaignNames);

      if (foundStates.length === 0) return [];

      // 3. Para cada estado, calcular métricas
      const metrics: StateMetric[] = [];

      for (const state of foundStates) {
        // Campanhas deste estado
        const stateCampaigns = campaigns.filter(c => 
          c.name.toUpperCase().includes(state.name)
        );
        const stateCampaignIds = stateCampaigns.map(c => c.id);

        // 3a. Total de contatos de listas com nome do estado
        const { data: lists } = await supabase
          .from("contact_lists")
          .select("total_contacts")
          .ilike("name", `%${state.name}%`);

        const totalContacts = lists?.reduce((sum, list) => sum + (list.total_contacts || 0), 0) || 0;

        // 3b. Disparos únicos (contact_id distintos com status='sent')
        let dispatchQuery = supabase
          .from("campaign_messages")
          .select("contact_id")
          .eq("status", "sent")
          .in("campaign_id", stateCampaignIds);

        if (dateRange) {
          dispatchQuery = dispatchQuery
            .gte("sent_at", dateRange.start.toISOString())
            .lte("sent_at", dateRange.end.toISOString());
        }

        const { data: dispatches } = await dispatchQuery;
        const uniqueDispatches = new Set(dispatches?.map(d => d.contact_id)).size;

        // 3c. Respostas (simples + interativas)
        // Respostas simples
        let simpleResponsesQuery = supabase
          .from("contact_responses")
          .select("contact_id")
          .in("campaign_id", stateCampaignIds);

        if (dateRange) {
          simpleResponsesQuery = simpleResponsesQuery
            .gte("received_at", dateRange.start.toISOString())
            .lte("received_at", dateRange.end.toISOString());
        }

        const { data: simpleResponses } = await simpleResponsesQuery;
        const simpleResponsesCount = new Set(simpleResponses?.map(r => r.contact_id)).size;

        // Respostas interativas (M1 + M2)
        let interactiveQuery = supabase
          .from("contact_interaction_status")
          .select("contact_id, message1_response_received_at, message2_response_received_at")
          .in("campaign_id", stateCampaignIds);

        const { data: interactiveResponses } = await interactiveQuery;

        let m1Count = 0;
        let m2Count = 0;

        if (interactiveResponses) {
          for (const resp of interactiveResponses) {
            if (resp.message1_response_received_at) {
              if (!dateRange || (
                new Date(resp.message1_response_received_at) >= dateRange.start &&
                new Date(resp.message1_response_received_at) <= dateRange.end
              )) {
                m1Count++;
              }
            }
            if (resp.message2_response_received_at) {
              if (!dateRange || (
                new Date(resp.message2_response_received_at) >= dateRange.start &&
                new Date(resp.message2_response_received_at) <= dateRange.end
              )) {
                m2Count++;
              }
            }
          }
        }

        const totalResponses = simpleResponsesCount + m1Count + m2Count;
        const responseRate = uniqueDispatches > 0 ? (totalResponses / uniqueDispatches) * 100 : 0;

        metrics.push({
          state: state.name,
          stateAbbr: state.abbr,
          totalContacts,
          uniqueDispatches,
          responses: totalResponses,
          campaignCount: stateCampaigns.length,
          responseRate,
        });
      }

      // Ordenar por quantidade de disparos (decrescente)
      return metrics.sort((a, b) => b.uniqueDispatches - a.uniqueDispatches);
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
