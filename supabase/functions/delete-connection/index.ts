import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteConnectionRequest {
  connectionId: string;
  previewOnly?: boolean;
  targetConnectionId?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { connectionId, previewOnly = false, targetConnectionId } = await req.json() as DeleteConnectionRequest;

    if (!connectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'connectionId é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[delete-connection] Modo: ${previewOnly ? 'PREVIEW' : 'EXECUTAR'} para conexão ${connectionId}`);

    // 1. Buscar informações da conexão
    const { data: connection } = await supabaseClient
      .from('whatsapp_connections')
      .select('id, name, empresa_id, user_id, instance_id, api_token')
      .eq('id', connectionId)
      .single();

    if (!connection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Conexão não encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 2. Verificar campanhas ativas usando esta conexão
    const { data: activeCampaigns } = await supabaseClient
      .from('campaign_connections')
      .select(`
        campaign_id,
        campaigns!inner(id, name, status)
      `)
      .eq('connection_id', connectionId)
      .in('campaigns.status', ['running', 'scheduled', 'paused']);

    const campaignsList = activeCampaigns?.map(cc => ({
      id: (cc.campaigns as any).id,
      name: (cc.campaigns as any).name,
      status: (cc.campaigns as any).status,
    })) || [];

    // 3. Verificar follow-ups ativos com contatos vinculados a esta conexão
    const { count: followUpsCount } = await supabaseClient
      .from('contact_follow_up_status')
      .select('id, contact_id, contacts!inner(preferred_connection_id)', { count: 'exact', head: true })
      .eq('contacts.preferred_connection_id', connectionId)
      .eq('is_active', true);

    // 4. Contar contatos vinculados a esta conexão
    const { count: contactsCount } = await supabaseClient
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('preferred_connection_id', connectionId);

    // 5. Contar mensagens no histórico
    const { count: messagesCount } = await supabaseClient
      .from('campaign_messages')
      .select('id', { count: 'exact', head: true })
      .eq('used_connection_id', connectionId);

    // 6. Buscar TODOS os chips disponíveis (sem filtrar por status)
    let query = supabaseClient
      .from('whatsapp_connections')
      .select('id, name, phone_number, status')
      .neq('id', connectionId);

    if (connection.empresa_id) {
      query = query.or(`empresa_id.eq.${connection.empresa_id},user_id.eq.${connection.user_id}`);
    } else {
      query = query.eq('user_id', connection.user_id);
    }

    const { data: availableConnections } = await query.order('status', { ascending: true });

    const warnings = {
      activeCampaigns: campaignsList,
      activeFollowUps: followUpsCount || 0,
      riskMessage: campaignsList.length > 0 || (followUpsCount || 0) > 0
        ? 'Leads vinculados a esta conexão poderão receber mensagens de chips diferentes, quebrando a regra de "chip oficial único por lead"'
        : null,
    };

    const impact = {
      contactsToTransfer: contactsCount || 0,
      messagesInHistory: messagesCount || 0,
    };

    // === MODO PREVIEW ===
    if (previewOnly) {
      console.log(`[delete-connection] Preview: ${contactsCount} contatos, ${availableConnections?.length || 0} chips disponíveis`);
      
      return new Response(
        JSON.stringify({
          success: true,
          previewOnly: true,
          warnings,
          impact,
          availableConnections: availableConnections || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // === MODO EXECUÇÃO ===
    console.log(`[delete-connection] Executando exclusão. Target: ${targetConnectionId || 'nenhum'}`);

    // 7. Transferir contatos para o chip escolhido (ou null)
    if ((contactsCount || 0) > 0) {
      const targetId = targetConnectionId || null;
      console.log(`[delete-connection] Transferindo ${contactsCount} contatos para ${targetId || 'NENHUM'}`);
      
      const { error: transferError } = await supabaseClient
        .from('contacts')
        .update({ preferred_connection_id: targetId })
        .eq('preferred_connection_id', connectionId);

      if (transferError) {
        console.error('[delete-connection] Erro ao transferir contatos:', transferError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao transferir contatos' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // 8. Chamar UAZAPI para desconectar e deletar instância
    const uazapiBaseUrl = Deno.env.get('UAZAPI_BASE_URL');
    const uazapiToken = Deno.env.get('UAZAPI_TOKEN');
    
    if (connection.instance_id && uazapiBaseUrl) {
      const token = connection.api_token || uazapiToken;
      
      try {
        // 8.1 Desconectar instância
        console.log(`[delete-connection] Chamando UAZAPI disconnect para ${connection.instance_id}`);
        const disconnectResponse = await fetch(`${uazapiBaseUrl}/instance/disconnect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': token || '',
          },
          body: JSON.stringify({ instanceId: connection.instance_id }),
        });
        
        const disconnectData = await disconnectResponse.json();
        console.log('[delete-connection] Disconnect response:', disconnectData);
        
        // Aguardar 1 segundo
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 8.2 Deletar instância
        console.log(`[delete-connection] Chamando UAZAPI delete para ${connection.instance_id}`);
        const deleteResponse = await fetch(`${uazapiBaseUrl}/instance/${connection.instance_id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'token': token || '',
          },
        });
        
        const deleteData = await deleteResponse.json();
        console.log('[delete-connection] Delete response:', deleteData);
        
        // Se falhou, tentar com admin token
        if (!deleteResponse.ok && uazapiToken && uazapiToken !== token) {
          console.log('[delete-connection] Tentando com admin token...');
          const retryResponse = await fetch(`${uazapiBaseUrl}/instance/${connection.instance_id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'token': uazapiToken,
            },
          });
          const retryData = await retryResponse.json();
          console.log('[delete-connection] Retry delete response:', retryData);
        }
      } catch (uazapiError) {
        // Continuar mesmo com erro na UAZAPI - deletar do banco local
        console.error('[delete-connection] Erro na UAZAPI (continuando):', uazapiError);
      }
    }

    // 9. Deletar a conexão do banco
    const { error: deleteError } = await supabaseClient
      .from('whatsapp_connections')
      .delete()
      .eq('id', connectionId);

    if (deleteError) {
      console.error('[delete-connection] Erro ao deletar conexão:', deleteError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao deletar conexão' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Buscar nome do chip destino para retorno
    let targetConnectionName = null;
    if (targetConnectionId) {
      const targetConn = availableConnections?.find(c => c.id === targetConnectionId);
      targetConnectionName = targetConn?.name || null;
    }

    console.log(`[delete-connection] Conexão ${connectionId} excluída com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        warnings,
        impact: {
          ...impact,
          newConnection: targetConnectionId ? { id: targetConnectionId, name: targetConnectionName } : null,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('[delete-connection] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
