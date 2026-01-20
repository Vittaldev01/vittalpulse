import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useAllUsers = () => {
  return useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      // Fetch profiles first (without user_roles join to avoid missing FK relationship error)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;
      
      if (!profiles || profiles.length === 0) return [];

      // Fetch user_roles separately
      const userIds = profiles.map(p => p.id);
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      if (rolesError) throw rolesError;

      // Create a map of user_id -> roles array
      const rolesMap: Record<string, { role: string }[]> = {};
      roles?.forEach(r => {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push({ role: r.role });
      });

      // Get unique empresa IDs (excluding null)
      const empresaIds = [...new Set(profiles.filter(u => u.empresa_id).map(u => u.empresa_id))] as string[];
      
      // Fetch empresa names separately
      let empresasMap: Record<string, string> = {};
      if (empresaIds.length > 0) {
        const { data: empresas } = await supabase
          .from("empresas")
          .select("id, nome")
          .in("id", empresaIds);
        
        empresasMap = Object.fromEntries((empresas || []).map(e => [e.id, e.nome]));
      }
      
      // Combine all data
      return profiles.map(user => ({
        ...user,
        user_roles: rolesMap[user.id] || [],
        empresas: user.empresa_id ? { nome: empresasMap[user.empresa_id] } : null
      }));
    },
  });
};

export const useUsersByEmpresa = (empresaId: string) => {
  return useQuery({
    queryKey: ["users-by-empresa", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles (role),
          empresas (nome)
        `)
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });
};

export const useUpdateUserEmpresa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, empresaId }: { userId: string; empresaId: string }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ empresa_id: empresaId })
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast.success("Empresa do usuário atualizada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar empresa: " + error.message);
    },
  });
};

export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "user" | "super_admin" }) => {
      // First check if role exists
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingRole) {
        // Update existing role
        const { data, error } = await supabase
          .from("user_roles")
          .update({ role: role as any })
          .eq("user_id", userId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new role
        const { data, error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: role as any })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast.success("Role do usuário atualizada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar role: " + error.message);
    },
  });
};

export const useCreateUserForEmpresa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, fullName, empresaId, role }: any) => {
      const { data, error } = await supabase.functions.invoke("create-admin-user", {
        body: { email, fullName, empresaId, role },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Erro ao criar usuário");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast.success("Usuário criado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao criar usuário: " + error.message);
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Erro ao deletar usuário");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast.success("Usuário excluído com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao deletar usuário: " + error.message);
    },
  });
};

export const useSendPasswordReset = () => {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke("send-password-reset", {
        body: { email },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Erro ao enviar email");
      return data;
    },
    onSuccess: () => {
      toast.success("Email de recuperação enviado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao enviar email: " + error.message);
    },
  });
};

export const useResetUserPassword = () => {
  return useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: { userId, newPassword },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Erro ao resetar senha");
      return data;
    },
    onSuccess: () => {
      toast.success("Senha resetada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao resetar senha: " + error.message);
    },
  });
};

export const useToggleUserApproval = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, approved }: { userId: string; approved: boolean }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ 
          approved,
          approved_at: approved ? new Date().toISOString() : null,
        })
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast.success(variables.approved ? "Usuário aprovado!" : "Usuário reprovado!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar aprovação: " + error.message);
    },
  });
};
