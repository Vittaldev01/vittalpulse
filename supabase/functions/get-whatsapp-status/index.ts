import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let connectionId: string | undefined;
  let supabase;

  try {
    const { connectionId: reqConnectionId } = await req.json();
    connectionId = reqConnectionId;
    console.log("🔍 Verificando status da conexão:", connectionId);

    supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar conexão
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

    console.log("📡 Iniciando conexão...");
    console.log("🔑 Usando token da instância:", connection.api_token.substring(0, 8) + "...");
    
    // Passo 1: POST /instance/connect (sem body, usando token da instância)
    const connectUrl = `${baseUrl}/instance/connect`;
    try {
      const connectResponse = await fetch(connectUrl, {
        method: "POST",
        headers: {
          "token": connection.api_token,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });
      console.log("🔌 Connect response:", connectResponse.status);
    } catch (e) {
      console.log("⚠️ Erro ao conectar (não crítico):", e);
    }

    // Aguardar 1 segundo para API processar
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Passo 2: GET /instance/status com retry logic (até 3 tentativas)
    console.log("📊 Buscando status...");
    const statusUrl = `${baseUrl}/instance/status?instanceId=${connection.instance_id}`;
    
    let statusData;
    let lastError = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 Tentativa ${attempt}/${maxRetries} de buscar status...`);
      
      try {
        const statusResponse = await fetch(statusUrl, {
          method: "GET",
          headers: {
            "token": connection.api_token,
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          lastError = `${statusResponse.status} ${errorText}`;
          console.error(`⚠️ Tentativa ${attempt} falhou:`, lastError);
          
          // Se for 404, aguardar antes de tentar novamente
          if (statusResponse.status === 404 && attempt < maxRetries) {
            console.log("⏳ Aguardando 2 segundos antes de tentar novamente...");
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          
          throw new Error(lastError);
        }

        statusData = await statusResponse.json();
        console.log("✅ Status recebido:", JSON.stringify(statusData, null, 2));
        break; // Sucesso, sair do loop
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        if (attempt < maxRetries) {
          console.log("⏳ Aguardando 2 segundos antes de tentar novamente...");
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.error("❌ Instância não encontrada após todas as tentativas");
          throw new Error(`Instância não encontrada na UAZAPI após ${maxRetries} tentativas`);
        }
      }
    }

    if (!statusData) {
      throw new Error("Não foi possível obter status da instância");
    }

    // 🔑 PONTO CRÍTICO: Extrair dados conforme documentação UAZAPI
    const isConnected = statusData.status?.connected === true;
    const isLoggedIn = statusData.status?.loggedIn === true;
    // Verificar tanto minúsculo (qrcode) quanto camelCase (qrCode) - UAZAPI retorna em minúsculo
    const qrCode = statusData.instance?.qrcode || statusData.instance?.qrCode || 
                   statusData.qrcode || statusData.qrCode || null;
    const pairingCode = statusData.instance?.paircode || statusData.instance?.pairingCode || 
                        statusData.paircode || statusData.pairingCode || null;
    const profileName = statusData.instance?.profileName || null;
    const phoneNumber = statusData.status?.jid?.user || null;

    // 🎯 LÓGICA DE STATUS: Determinar se está conectado
    let finalStatus = "disconnected";
    if (isConnected && isLoggedIn) {
      finalStatus = "connected"; // ✅ QR CODE FOI ESCANEADO!
    } else if (qrCode || pairingCode) {
      finalStatus = "pending"; // ⏳ Aguardando scan
    }

    console.log(`📱 Status final: ${finalStatus}`);

    // Atualizar no banco
    const updateData: any = {
      status: finalStatus,
      qr_code: qrCode,
      pairing_code: pairingCode,
      updated_at: new Date().toISOString(),
      last_error: null, // Limpar erro em caso de sucesso
    };

    // Se conectado, salvar dados adicionais
    if (isConnected && isLoggedIn) {
      updateData.connected_at = new Date().toISOString();
      if (phoneNumber) updateData.phone_number = phoneNumber;
    }

    await supabase
      .from("whatsapp_connections")
      .update(updateData)
      .eq("id", connectionId);

    return new Response(
      JSON.stringify({
        success: true,
        status: finalStatus,
        connected: isConnected,
        loggedIn: isLoggedIn,
        qrCode,
        pairingCode,
        phoneNumber,
        profileName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("❌ Erro:", e);
    
    // NÃO atualizar status para disconnected em erros de rede
    // Apenas registrar o erro sem alterar o status para evitar falsos positivos
    if (supabase && connectionId) {
      try {
        await supabase
          .from("whatsapp_connections")
          .update({
            last_error: e instanceof Error ? e.message : "Erro ao comunicar com UAZAPI",
            updated_at: new Date().toISOString(),
          })
          .eq("id", connectionId);
      } catch (dbError) {
        console.error("Erro ao atualizar banco:", dbError);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Erro ao comunicar com UAZAPI",
        status: "disconnected",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
