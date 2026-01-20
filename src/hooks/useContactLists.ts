import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ContactList {
  id: string;
  name: string;
  description: string | null;
  total_contacts: number;
  created_at: string;
}

export const useContactLists = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lists, isLoading } = useQuery({
    queryKey: ["contact_lists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_lists")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ContactList[];
    },
  });

  const createList = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("contact_lists")
        .insert([
          {
            user_id: user.id,
            name,
            description: description || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact_lists"] });
      toast({
        title: "Lista criada!",
        description: "Sua lista de contatos foi criada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar lista",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contact_lists")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact_lists"] });
      toast({
        title: "Lista excluída!",
        description: "A lista foi removida com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir lista",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    lists: lists || [],
    isLoading,
    createList,
    deleteList,
  };
};
