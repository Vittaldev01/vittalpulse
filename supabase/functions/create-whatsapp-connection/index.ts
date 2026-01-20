import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  try {
    const { name, connectionId } = await req.json();
    console.log("🔧 Criando instância:", name);
    
    const adminToken = Deno.env.get("UAZAPI_TOKEN");
    const baseUrl = Deno.env.get("UAZAPI_BASE_URL")?.replace(/\/$/, "");
    
    if (!adminToken || !baseUrl) {
      throw new Error("Configuração incompleta: UAZAPI_TOKEN ou UAZAPI_BASE_URL não definidos");
    }

    // Passo 1: Criar instância na UAZAPI
    const createUrl = `${baseUrl}/instance/init`;
    console.log("📡 Chamando:", createUrl);
    
    const createResponse = await fetch(createUrl, {
      method: "POST",
      headers: {
        "admintoken": adminToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("❌ Erro ao criar instância:", createResponse.status, errorText);
      throw new Error(`Falha ao criar instância: ${createResponse.status} - ${errorText}`);
    }

    const data = await createResponse.json();
    console.log("✅ Resposta completa da criação:", JSON.stringify(data, null, 2));

    // Passo 2: Extrair instance_id e api_token da resposta
    const instanceId = data.instance?.id || data.id;
    const apiToken = data.token || data.instance?.token;

    console.log("📦 Instance ID:", instanceId);
    console.log("🔑 API Token:", apiToken ? "Presente" : "Ausente");

    if (!instanceId || !apiToken) {
      console.error("❌ Resposta inválida:", data);
      throw new Error("Resposta da API não contém instance.id ou token");
    }

    // Passo 3: Salvar no banco de dados
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase
      .from("whatsapp_connections")
      .update({
        instance_id: instanceId,
        api_token: apiToken,
        status: "pending",
        last_error: null,
      })
      .eq("id", connectionId);

    console.log("💾 Conexão salva no banco");

    // Passo 4: Configurar webhook automaticamente
    console.log("🔧 Configurando webhook automaticamente...");
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-handler`;
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
      console.log("📡 Tentando POST /webhook...");
      const postResponse = await fetch(`${baseUrl}/webhook`, {
        method: "POST",
        headers: {
          "token": apiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(webhookPayload),
      });

      if (postResponse.ok) {
        webhookConfigured = true;
        console.log("✅ Webhook configurado via POST");
      } else {
        const postError = await postResponse.text();
        console.warn("⚠️ POST falhou:", postResponse.status, postError);
        
        // Fallback: tentar PUT /webhook
        console.log("📡 Tentando PUT /webhook como fallback...");
        const putResponse = await fetch(`${baseUrl}/webhook`, {
          method: "PUT",
          headers: {
            "token": apiToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(webhookPayload),
        });

        if (putResponse.ok) {
          webhookConfigured = true;
          console.log("✅ Webhook configurado via PUT");
        } else {
          const putError = await putResponse.text();
          console.warn("⚠️ PUT também falhou:", putResponse.status, putError);
        }
      }
    } catch (webhookError) {
      console.warn("⚠️ Erro ao configurar webhook:", webhookError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        instanceId,
        webhookConfigured,
        message: webhookConfigured 
          ? "Instância criada e webhook configurado com sucesso!" 
          : "Instância criada com sucesso. Configure o webhook manualmente se necessário.",
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
