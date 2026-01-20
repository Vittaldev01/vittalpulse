import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";

export interface WhatsAppConnection {
  id: string;
  name: string;
  instance_id: string | null;
  status: "connected" | "disconnected" | "pending";
  qr_code: string | null;
  phone_number: string | null;
  connected_at: string | null;
  created_at: string;
  qr_endpoint_preference: string | null;
  last_error: string | null;
  pairing_code: string | null;
  pairing_code_expires_at: string | null;
}

export interface AvailableConnection {
  id: string;
  name: string;
  phone_number: string | null;
  status: string;
}

export interface DeletePreviewResult {
  success: boolean;
  previewOnly: boolean;
  warnings: {
    activeCampaigns: Array<{ id: string; name: string; status: string }>;
    activeFollowUps: number;
    riskMessage: string | null;
  };
  impact: {
    contactsToTransfer: number;
    messagesInHistory: number;
  };
  availableConnections: AvailableConnection[];
}

export const useConnections = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasSyncedOnMount = useRef(false);

  const { data: connections, isLoading } = useQuery({
    queryKey: ["whatsapp_connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as WhatsAppConnection[];
    },
  });

  // 🔄 Sync all connections status mutation
  const syncAllStatus = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-connection-status");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_connections"] });
      if (data?.updated > 0) {
        toast({
          title: "Status atualizado!",
          description: `${data.updated} conexão(ões) tiveram o status corrigido.`,
        });
      }
    },
    onError: (error) => {
      console.error("Error syncing connection status:", error);
      toast({
        title: "Erro ao sincronizar",
        description: "Não foi possível atualizar o status das conexões.",
        variant: "destructive",
      });
    },
  });

  // 🚀 Auto-sync on mount (once)
  useEffect(() => {
    if (!hasSyncedOnMount.current && connections && connections.length > 0) {
      hasSyncedOnMount.current = true;
      syncAllStatus.mutate();
    }
  }, [connections?.length]);

  // 🔄 AUTO-POLLING: Verificar status de TODAS as conexões a cada 30 segundos
  useEffect(() => {
    if (!connections || connections.length === 0) return;

    const allConnections = connections.filter(conn => conn.instance_id);
    if (allConnections.length === 0) return;

    console.log("🔄 Auto-polling iniciado para", allConnections.length, "conexões (TODAS)");

    const interval = setInterval(async () => {
      for (const conn of allConnections) {
        try {
          const { data, error } = await supabase.functions.invoke("get-whatsapp-status", {
            body: { connectionId: conn.id },
          });
          
          if (error) {
            console.error("❌ Erro no polling:", error);
          } else if (data && !data.success) {
            console.warn("⚠️ Status check retornou erro:", data.error);
          } else {
            console.log("✅ Status atualizado:", conn.name, "→", data?.status);
          }
          
          queryClient.invalidateQueries({ queryKey: ["whatsapp_connections"] });
        } catch (error) {
          console.error("❌ Erro ao verificar status:", error);
        }
      }
    }, 30000); // ⏱️ 30 segundos

    return () => {
      console.log("🛑 Auto-polling parado");
      clearInterval(interval);
    };
  }, [connections, queryClient]);

  const createConnection = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // First, create the connection record in the database
      const { data: connection, error } = await supabase
        .from("whatsapp_connections")
        .insert([
          {
            user_id: user.id,
            name,
            status: "pending",
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Then, call the edge function to create the instance on Uazapi
      const { data: instanceData, error: edgeFunctionError } = await supabase.functions.invoke(
        "create-whatsapp-connection",
        {
          body: { 
            name,
            connectionId: connection.id
          },
        }
      );

      if (edgeFunctionError) {
        console.error("Erro ao chamar edge function:", edgeFunctionError);
        throw new Error(edgeFunctionError.message || "Erro ao criar instância");
      }

      console.log("Instância criada com sucesso:", instanceData);
      return connection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_connections"] });
      toast({
        title: "Conexão criada!",
        description: "QR Code gerado. Escaneie para conectar.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar conexão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("whatsapp_connections")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_connections"] });
      toast({
        title: "Conexão excluída!",
        description: "A conexão foi removida com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir conexão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Preview de exclusão (não executa, só mostra informações)
  const previewDeleteConnection = useMutation({
    mutationFn: async (connectionId: string): Promise<DeletePreviewResult> => {
      const { data, error } = await supabase.functions.invoke("delete-connection", {
        body: { connectionId, previewOnly: true },
      });

      if (error) throw error;
      return data as DeletePreviewResult;
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao analisar conexão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Exclusão segura com transferência de contatos
  const deleteConnectionSafe = useMutation({
    mutationFn: async ({ connectionId, targetConnectionId }: { 
      connectionId: string; 
      targetConnectionId: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("delete-connection", {
        body: { connectionId, previewOnly: false, targetConnectionId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_connections"] });
      
      if (data?.success && data.impact?.contactsToTransfer > 0) {
        if (data.impact.newConnection) {
          toast({
            title: "Conexão excluída!",
            description: `${data.impact.contactsToTransfer} contato(s) transferido(s) para "${data.impact.newConnection.name}"`,
          });
        } else {
          toast({
            title: "Conexão excluída!",
            description: `${data.impact.contactsToTransfer} contato(s) desvinculados.`,
          });
        }
      } else if (data?.success) {
        toast({
          title: "Conexão excluída!",
          description: "A conexão foi removida com sucesso.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir conexão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const checkConnectionStatus = useMutation({
    mutationFn: async (connectionId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "get-whatsapp-status",
        {
          body: { connectionId },
        }
      );

      if (error) throw error;
      
      // Verificar se a resposta indica falha (instância não encontrada)
      if (data && !data.success) {
        console.warn("Instância não encontrada:", data.error);
        // Não lançar erro - apenas retornar os dados para o componente tratar
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_connections"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao verificar status:", error);
    },
  });

  const generatePairingCode = useMutation({
    mutationFn: async ({ connectionId, phone }: { connectionId: string; phone: string }) => {
      const { data, error } = await supabase.functions.invoke(
        "generate-pairing-code",
        {
          body: { connectionId, phone },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_connections"] });
      queryClient.refetchQueries({ queryKey: ["whatsapp_connections"] });
      toast({ title: "Código gerado!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar código",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  return {
    connections: connections || [],
    isLoading,
    createConnection,
    deleteConnection,
    previewDeleteConnection,
    deleteConnectionSafe,
    checkConnectionStatus,
    generatePairingCode,
    syncAllStatus,
  };
};
