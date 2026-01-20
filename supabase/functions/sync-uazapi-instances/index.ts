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
    const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL');
    const UAZAPI_GLOBAL_TOKEN = Deno.env.get('UAZAPI_GLOBAL_TOKEN');

    if (!UAZAPI_BASE_URL || !UAZAPI_GLOBAL_TOKEN) {
      throw new Error('UAZAPI credentials not configured');
    }

    console.log('Fetching all instances from UAZAPI...');

    // Buscar todas as instâncias do UAZAPI
    const response = await fetch(`${UAZAPI_BASE_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${UAZAPI_GLOBAL_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('UAZAPI API error:', errorText);
      throw new Error(`UAZAPI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('UAZAPI instances fetched:', data);

    // Buscar instâncias já existentes no Lovable
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingConnections } = await supabase
      .from('whatsapp_connections')
      .select('instance_id, name, status');

    const existingInstanceIds = new Set(
      existingConnections?.map(c => c.instance_id) || []
    );

    // Filtrar instâncias que não estão no Lovable
    const availableInstances = (data.data || []).map((instance: any) => ({
      id: instance.id,
      name: instance.name,
      token: instance.token,
      status: instance.status,
      phone: instance.phone || null,
      isImported: existingInstanceIds.has(instance.id),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        instances: availableInstances,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing UAZAPI instances:', error);
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
