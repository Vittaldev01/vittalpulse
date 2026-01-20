import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { connectionId, phone } = await req.json();
    if (!connectionId) throw new Error("connectionId é obrigatório");
    if (!phone) throw new Error("phone é obrigatório");

    console.log("🔑 Gerando código de pareamento para:", phone);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: connection, error: fetchError } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (fetchError || !connection) {
      throw new Error(`Conexão não encontrada: ${fetchError?.message}`);
    }

    if (!connection.instance_id || !connection.api_token) {
      throw new Error("Conexão sem instance_id ou api_token");
    }

    const baseUrl = Deno.env.get("UAZAPI_BASE_URL")?.replace(/\/$/, "");
    if (!baseUrl) throw new Error("UAZAPI_BASE_URL não configurado");

    // Passo 1: POST /instance/connect com phone no body para gerar pairing code
    console.log("📡 Solicitando pairing code...");
    const connectUrl = `${baseUrl}/instance/connect`;
    
    try {
      const connectResponse = await fetch(connectUrl, {
        method: "POST",
        headers: {
          "token": connection.api_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });
      console.log("🔌 Connect response:", connectResponse.status);
    } catch (e) {
      console.log("⚠️ Erro ao conectar:", e);
    }

    // Aguardar 1 segundo para API processar
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Passo 2: GET /instance/status para obter o pairing code gerado
    console.log("📊 Buscando pairing code...");
    const statusUrl = `${baseUrl}/instance/status`;
    const statusResponse = await fetch(statusUrl, {
      method: "GET",
      headers: {
        "token": connection.api_token,
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error("❌ Erro ao buscar status:", statusResponse.status, errorText);
      throw new Error(`Erro ao verificar status: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    console.log("✅ Status recebido:", JSON.stringify(statusData, null, 2));

    // Extrair pairing code
    const pairingCode = statusData.instance?.pairingCode || statusData.pairingCode || null;

    if (pairingCode) {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
      
      await supabase
        .from("whatsapp_connections")
        .update({
          pairing_code: pairingCode,
          pairing_code_expires_at: expiresAt.toISOString(),
          status: "pending",
          last_error: null,
        })
        .eq("id", connectionId);

      console.log("✅ Pairing code gerado:", pairingCode);

      return new Response(
        JSON.stringify({
          success: true,
          pairingCode,
          expiresAt: expiresAt.toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorMsg = "Não foi possível gerar código de pareamento";
      await supabase
        .from("whatsapp_connections")
        .update({ last_error: errorMsg })
        .eq("id", connectionId);

      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("❌ Erro:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
