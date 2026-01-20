import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const usePlanos = () => {
  return useQuery({
    queryKey: ["planos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos")
        .select("*")
        .order("preco_mensal", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
};

export const usePlanoById = (id: string) => {
  return useQuery({
    queryKey: ["plano", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useCreatePlano = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (plano: any) => {
      const { data, error } = await supabase
        .from("planos")
        .insert(plano)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planos"] });
      toast.success("Plano criado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao criar plano: " + error.message);
    },
  });
};

export const useUpdatePlano = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from("planos")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planos"] });
      toast.success("Plano atualizado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar plano: " + error.message);
    },
  });
};

export const useDeletePlano = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete: apenas marca como inativo
      const { data, error } = await supabase
        .from("planos")
        .update({ is_active: false })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planos"] });
      toast.success("Plano desativado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao desativar plano: " + error.message);
    },
  });
};
