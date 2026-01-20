import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { connection_id, phone, message, media_url, media_type } = await req.json();

    if (!connection_id || !phone || !message) {
      return new Response(
        JSON.stringify({ error: "connection_id, phone e message são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const uazapiBaseUrl = Deno.env.get("UAZAPI_BASE_URL");
    const globalToken = Deno.env.get("UAZAPI_TOKEN");
    
    if (!uazapiBaseUrl) {
      throw new Error("UAZAPI_BASE_URL não configurado");
    }
    if (!globalToken) {
      throw new Error("UAZAPI_TOKEN não configurado");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch connection data from database
    const { data: connection, error: fetchError } = await supabase
      .from("whatsapp_connections")
      .select("instance_id, api_token")
      .eq("id", connection_id)
      .single();

    if (fetchError || !connection) {
      console.error("Erro ao buscar conexão:", fetchError);
      throw new Error("Conexão não encontrada");
    }

    if (!connection.instance_id) {
      throw new Error("Instância não configurada para esta conexão");
    }

    // Use instance token if available, otherwise use global token
    const token = connection.api_token || globalToken;
    console.log(`Usando token ${connection.api_token ? "da instância" : "global"} para instância ${connection.instance_id}`);

    let endpoint = `${uazapiBaseUrl}/send/text`;
    let body: any = {
      number: phone,
      text: message,
    };

    // If there's media, use the media endpoint instead
    if (media_url && media_type && media_type !== "none") {
      endpoint = `${uazapiBaseUrl}/send/media`;
      body = {
        number: phone,
        type: media_type,
        file: media_url,
        text: message,
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Uazapi error:", response.status, errorText);
      throw new Error(`Erro ao enviar mensagem: ${response.status}`);
    }

    const data = await response.json();
    console.log("Mensagem enviada com sucesso:", data);

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro em send-whatsapp-message:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
