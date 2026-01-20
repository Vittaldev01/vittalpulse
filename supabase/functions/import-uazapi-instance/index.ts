import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceId, instanceToken, instanceName } = await req.json();

    if (!instanceId || !instanceToken) {
      throw new Error('Instance ID and token are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obter user_id do token de autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    console.log(`Importing instance ${instanceId} for user ${user.id}`);

    // Verificar se já existe no banco
    const { data: existing } = await supabase
      .from('whatsapp_connections')
      .select('id')
      .eq('instance_id', instanceId)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Esta instância já foi importada',
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Buscar status atual da instância na UAZAPI
    const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL');
    const statusResponse = await fetch(`${UAZAPI_BASE_URL}/instance/${instanceId}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${instanceToken}`,
        'Content-Type': 'application/json',
      },
    });

    let qrCode = null;
    let phoneNumber = null;
    let status = 'pending';
    let connectedAt = null;

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('Instance status from UAZAPI:', statusData);

      if (statusData.data?.instance?.state === 'open') {
        status = 'connected';
        connectedAt = new Date().toISOString();
        phoneNumber = statusData.data.instance.owner || null;
      } else if (statusData.data?.qrcode?.code) {
        qrCode = statusData.data.qrcode.code;
        status = 'pending';
      }
    }

    // Inserir no banco de dados
    const { data: newConnection, error: insertError } = await supabase
      .from('whatsapp_connections')
      .insert({
        user_id: user.id,
        name: instanceName || `Importado - ${instanceId}`,
        instance_id: instanceId,
        api_token: instanceToken,
        status,
        qr_code: qrCode,
        phone_number: phoneNumber,
        connected_at: connectedAt,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting connection:', insertError);
      throw insertError;
    }

    console.log('Instance imported successfully:', newConnection);

    // Configurar webhook automaticamente
    console.log('🔧 Configurando webhook automaticamente...');
    const UAZAPI_BASE_URL_CLEAN = UAZAPI_BASE_URL?.replace(/\/$/, '');
    const webhookUrl = `${supabaseUrl}/functions/v1/webhook-handler`;
    let webhookConfigured = false;

    // Payload conforme especificação
    const webhookPayload = {
      url: webhookUrl,
      enabled: true,
      events: ['messages', 'connection'],
      excludeMessages: ['wasSentByApi'],
    };

    try {
      // Tentar POST /webhook primeiro
      console.log('📡 Tentando POST /webhook...');
      const postResponse = await fetch(`${UAZAPI_BASE_URL_CLEAN}/webhook`, {
        method: 'POST',
        headers: {
          'token': instanceToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (postResponse.ok) {
        webhookConfigured = true;
        console.log('✅ Webhook configurado via POST');
      } else {
        const postError = await postResponse.text();
        console.warn('⚠️ POST falhou:', postResponse.status, postError);
        
        // Fallback: tentar PUT /webhook
        console.log('📡 Tentando PUT /webhook como fallback...');
        const putResponse = await fetch(`${UAZAPI_BASE_URL_CLEAN}/webhook`, {
          method: 'PUT',
          headers: {
            'token': instanceToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
        });

        if (putResponse.ok) {
          webhookConfigured = true;
          console.log('✅ Webhook configurado via PUT');
        } else {
          const putError = await putResponse.text();
          console.warn('⚠️ PUT também falhou:', putResponse.status, putError);
        }
      }
    } catch (webhookError) {
      console.warn('⚠️ Erro ao configurar webhook:', webhookError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        connection: newConnection,
        webhookConfigured,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error importing UAZAPI instance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
