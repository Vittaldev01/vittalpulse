import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UazapiInstance {
  id: string;
  name: string;
  token: string;
  status: string;
  phone: string | null;
  isImported: boolean;
}

export const useSyncUazapi = () => {
  const queryClient = useQueryClient();

  const fetchInstances = useQuery({
    queryKey: ['uazapi-instances'],
    queryFn: async () => {
      console.log('Fetching UAZAPI instances...');
      const { data, error } = await supabase.functions.invoke('sync-uazapi-instances');
      
      if (error) {
        console.error('Error fetching UAZAPI instances:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar instâncias');
      }

      console.log('UAZAPI instances fetched:', data.instances);
      return data.instances as UazapiInstance[];
    },
    enabled: false, // Só buscar quando explicitamente solicitado
  });

  const importInstance = useMutation({
    mutationFn: async ({ instanceId, instanceToken, instanceName }: { 
      instanceId: string; 
      instanceToken: string; 
      instanceName: string;
    }) => {
      console.log('Importing instance:', instanceId);
      
      const { data, error } = await supabase.functions.invoke('import-uazapi-instance', {
        body: { instanceId, instanceToken, instanceName },
      });

      if (error) {
        console.error('Error importing instance:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao importar instância');
      }

      return data.connection;
    },
    onSuccess: () => {
      toast.success('Instância importada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-connections'] });
      queryClient.invalidateQueries({ queryKey: ['uazapi-instances'] });
    },
    onError: (error: Error) => {
      console.error('Import error:', error);
      toast.error(error.message || 'Erro ao importar instância');
    },
  });

  return {
    instances: fetchInstances.data || [],
    isLoading: fetchInstances.isLoading,
    isFetching: fetchInstances.isFetching,
    fetchInstances: fetchInstances.refetch,
    importInstance,
  };
};
