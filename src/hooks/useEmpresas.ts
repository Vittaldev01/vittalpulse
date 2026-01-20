import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useEmpresas = () => {
  return useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data: empresas, error } = await supabase
        .from("empresas")
        .select(`
          *,
          profiles:profiles(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch additional stats for each empresa
      const empresasWithStats = await Promise.all(
        (empresas || []).map(async (empresa) => {
          const [connections, contacts, campaigns] = await Promise.all([
            supabase
              .from("whatsapp_connections")
              .select("id", { count: "exact", head: true })
              .eq("empresa_id", empresa.id),
            supabase
              .from("contacts")
              .select("id", { count: "exact", head: true })
              .eq("empresa_id", empresa.id),
            supabase
              .from("campaigns")
              .select("id", { count: "exact", head: true })
              .eq("empresa_id", empresa.id)
              .in("status", ["running", "scheduled"]),
          ]);

          return {
            ...empresa,
            users_count: empresa.profiles?.[0]?.count || 0,
            connections_count: connections.count || 0,
            contacts_count: contacts.count || 0,
            active_campaigns_count: campaigns.count || 0,
          };
        })
      );

      return empresasWithStats;
    },
  });
};

export const useEmpresaById = (id: string) => {
  return useQuery({
    queryKey: ["empresa", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useEmpresasStats = () => {
  return useQuery({
    queryKey: ["empresas-stats"],
    queryFn: async () => {
      const [empresas, profiles, connections, dispatches] = await Promise.all([
        supabase
          .from("empresas")
          .select("id, status, disparos_usados_mes_atual, limite_disparos_mensal", { count: "exact" })
          .eq("status", "ativo"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("whatsapp_connections")
          .select("id", { count: "exact", head: true })
          .eq("status", "connected"),
        supabase
          .from("empresas")
          .select("disparos_usados_mes_atual, limite_disparos_mensal"),
      ]);

      const totalDispatches = (dispatches.data || []).reduce(
        (sum, e) => sum + (e.disparos_usados_mes_atual || 0),
        0
      );

      const avgUsage = (dispatches.data || []).reduce((sum, e) => {
        const usage = e.limite_disparos_mensal > 0
          ? (e.disparos_usados_mes_atual / e.limite_disparos_mensal) * 100
          : 0;
        return sum + usage;
      }, 0) / (dispatches.data?.length || 1);

      return {
        active_companies: empresas.count || 0,
        total_users: profiles.count || 0,
        connected_chips: connections.count || 0,
        total_dispatches: totalDispatches,
        avg_usage: avgUsage,
      };
    },
  });
};

export const useCreateEmpresa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const { data: empresa, error } = await supabase
        .from("empresas")
        .insert({
          nome: data.nome,
          cnpj: data.cnpj,
          email_contato: data.email_contato,
          telefone: data.telefone,
          plano_nome: data.plano_nome,
          limite_disparos_mensal: data.limite_disparos_mensal,
          limite_conexoes: data.limite_conexoes,
          limite_contatos: data.limite_contatos,
          limite_campanhas_simultaneas: data.limite_campanhas_simultaneas,
          features_habilitadas: data.features_habilitadas,
          notas_internas: data.notas_internas,
          status: "ativo",
        })
        .select()
        .single();

      if (error) throw error;
      return empresa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-stats"] });
      toast.success("Empresa criada com sucesso");
    },
    onError: (error: any) => {
      toast.error("Erro ao criar empresa", {
        description: error.message,
      });
    },
  });
};

export const useUpdateEmpresa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: empresa, error } = await supabase
        .from("empresas")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return empresa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-stats"] });
      toast.success("Empresa atualizada com sucesso");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar empresa", {
        description: error.message,
      });
    },
  });
};

export const useResetDispatchCounter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (empresaId: string) => {
      const { error } = await supabase
        .from("empresas")
        .update({
          disparos_usados_mes_atual: 0,
          ultimo_reset_contador: new Date().toISOString(),
        })
        .eq("id", empresaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      toast.success("Contador de disparos resetado");
    },
    onError: (error: any) => {
      toast.error("Erro ao resetar contador", {
        description: error.message,
      });
    },
  });
};
