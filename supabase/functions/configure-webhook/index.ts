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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { connectionId } = await req.json();

    if (!connectionId) {
      throw new Error('connectionId é obrigatório');
    }

    // Buscar conexão
    const { data: connection, error: connectionError } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('id', connectionId)
      .maybeSingle();

    if (connectionError) {
      console.error('❌ Erro ao buscar conexão:', connectionError);
      throw new Error(`Erro ao buscar conexão: ${connectionError.message}`);
    }

    if (!connection) {
      console.error(`❌ Conexão não encontrada no banco de dados. ID: ${connectionId}`);
      throw new Error(`Conexão não encontrada. Atualize a página e tente novamente.`);
    }

    console.log(`✅ Conexão encontrada: ${connection.name} (${connection.id})`);
    console.log(`📱 Instance ID: ${connection.instance_id}`);

    if (!connection.instance_id || !connection.api_token) {
      throw new Error('Conexão não possui instance_id ou api_token');
    }

    // URL do webhook
    const webhookUrl = `${supabaseUrl}/functions/v1/webhook-handler`;
    
    // Base URL da API UAZAPI
    const uazapiBaseUrl = Deno.env.get('UAZAPI_BASE_URL') || 'https://cluster.uazapi.com/api';
    const globalToken = Deno.env.get('UAZAPI_GLOBAL_TOKEN');
    
    // Usar token da instância se disponível, senão global
    const authToken = connection.api_token || globalToken;

    if (!authToken) {
      throw new Error('Token de autenticação não encontrado');
    }

    console.log(`🔧 Configurando webhook para instância ${connection.instance_id}`);
    console.log(`📍 URL do webhook: ${webhookUrl}`);

    // Payload conforme especificação
    const webhookPayload = {
      url: webhookUrl,
      enabled: true,
      events: ['messages', 'connection'],
      excludeMessages: ['wasSentByApi'],
    };

    let webhookConfigured = false;
    let apiResponse;

    // Tentar POST /webhook primeiro (conforme especificação)
    console.log('📡 Tentando POST /webhook...');
    const postResponse = await fetch(`${uazapiBaseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'token': authToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (postResponse.ok) {
      apiResponse = await postResponse.json();
      webhookConfigured = true;
      console.log('✅ Webhook configurado via POST:', apiResponse);
    } else {
      const postError = await postResponse.text();
      console.warn('⚠️ POST falhou:', postResponse.status, postError);
      
      // Fallback: tentar PUT /webhook
      console.log('📡 Tentando PUT /webhook como fallback...');
      const putResponse = await fetch(`${uazapiBaseUrl}/webhook`, {
        method: 'PUT',
        headers: {
          'token': authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (putResponse.ok) {
        apiResponse = await putResponse.json();
        webhookConfigured = true;
        console.log('✅ Webhook configurado via PUT:', apiResponse);
      } else {
        const putError = await putResponse.text();
        console.warn('⚠️ PUT também falhou:', putResponse.status, putError);
        // Não vamos falhar, apenas informar que precisa configurar manualmente
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        webhookConfigured,
        webhookUrl,
        message: webhookConfigured 
          ? 'Webhook configurado automaticamente com sucesso!' 
          : 'Configure manualmente o webhook no painel UAZAPI com a URL fornecida.',
        apiResponse,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Erro ao configurar webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        webhookUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-handler`,
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
