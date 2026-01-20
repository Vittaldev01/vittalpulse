import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const uazapiBaseUrl = Deno.env.get('UAZAPI_BASE_URL')!;
    const globalToken = Deno.env.get('UAZAPI_TOKEN')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Sincronizando status de todas as conexões...');

    // Buscar todas as conexões
    const { data: connections, error: connectionsError } = await supabase
      .from('whatsapp_connections')
      .select('id, name, instance_id, api_token, status');

    if (connectionsError) throw connectionsError;

    if (!connections || connections.length === 0) {
      console.log('ℹ️ Nenhuma conexão encontrada');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhuma conexão para sincronizar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updated = 0;
    let unchanged = 0;

    for (const connection of connections) {
      try {
        const apiToken = connection.api_token || globalToken;
        
        // Verificar status real na UAZAPI
        const response = await fetch(`${uazapiBaseUrl}/instance/status?instanceId=${connection.instance_id}`, {
          method: 'GET',
          headers: {
            'token': apiToken
          }
        });

        if (!response.ok) {
          console.log(`⚠️ ${connection.name}: Erro ao verificar status (${response.status})`);
          continue;
        }

        const data = await response.json();
        
        // Log completo do payload da UAZAPI para debug
        console.log(`📦 ${connection.name} - Payload UAZAPI:`, JSON.stringify(data, null, 2));
        
        // Verificar múltiplos campos para determinar status correto
        const instanceStatus = data.instance?.status;
        const statusConnected = data.status?.connected;
        const statusLoggedIn = data.status?.loggedIn;
        
        console.log(`🔍 ${connection.name} - instance.status: ${instanceStatus}, status.connected: ${statusConnected}, status.loggedIn: ${statusLoggedIn}`);
        
        const isConnected = instanceStatus === 'connected' || 
                           (statusConnected === true && statusLoggedIn === true);
        const realStatus = isConnected ? 'connected' : 'disconnected';
        
        console.log(`✅ ${connection.name} - Status determinado: ${realStatus}`);

        // Atualizar se divergente
        if (realStatus !== connection.status) {
          await supabase
            .from('whatsapp_connections')
            .update({ status: realStatus })
            .eq('id', connection.id);
          
          console.log(`✅ ${connection.name}: ${connection.status} → ${realStatus}`);
          updated++;
        } else {
          unchanged++;
        }
      } catch (error) {
        console.error(`❌ Erro ao processar ${connection.name}:`, error);
        // NÃO atualizar status para disconnected em erros de rede
        // Manter status anterior para evitar falsos positivos
      }
    }

    console.log(`\n📊 Sincronização concluída:`);
    console.log(`   - Atualizados: ${updated}`);
    console.log(`   - Sem mudanças: ${unchanged}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated, 
        unchanged,
        total: connections.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
