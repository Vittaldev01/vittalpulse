import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { connectionId } = await req.json();
    console.log("🔄 Reconectando instância:", connectionId);

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

    // Passo 1: POST /instance/disconnect para limpar sessão anterior
    console.log("🔌 Desconectando sessão anterior...");
    const disconnectUrl = `${baseUrl}/instance/disconnect`;
    
    try {
      await fetch(disconnectUrl, {
        method: "POST",
        headers: {
          "token": connection.api_token,
        },
      });
      console.log("✅ Desconectado");
    } catch (e) {
      console.log("⚠️ Erro ao desconectar (não crítico):", e);
    }

    // Aguardar 1 segundo
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Passo 2: POST /instance/connect (sem body) para gerar novo QR
    console.log("📡 Iniciando nova conexão...");
    const connectUrl = `${baseUrl}/instance/connect`;
    
    try {
      await fetch(connectUrl, {
        method: "POST",
        headers: {
          "token": connection.api_token,
          "Content-Type": "application/json",
        },
      });
      console.log("✅ Conexão iniciada");
    } catch (e) {
      console.log("⚠️ Erro ao conectar:", e);
    }

    // Aguardar 1 segundo
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Passo 3: GET /instance/status para obter novo QR code
    console.log("📊 Buscando QR code...");
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
    console.log("✅ Status recebido");

    const qrCode = statusData.instance?.qrCode || statusData.qrCode || null;

    // Atualizar no banco
    await supabase
      .from("whatsapp_connections")
      .update({
        status: "pending",
        qr_code: qrCode,
        pairing_code: null,
        pairing_code_expires_at: null,
        last_error: qrCode ? null : "Não foi possível obter QR Code",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);

    return new Response(
      JSON.stringify({
        success: true,
        message: qrCode ? "QR Code regenerado com sucesso" : "Aguardando QR Code...",
        qrCode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
