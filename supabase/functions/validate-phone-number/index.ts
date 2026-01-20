import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidationResult {
  phone_id: string;
  phone: string;
  is_whatsapp: boolean;
  phone_type: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_ids, connection_id } = await req.json();

    if (!phone_ids || !Array.isArray(phone_ids) || phone_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "phone_ids é obrigatório e deve ser um array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!connection_id) {
      return new Response(
        JSON.stringify({ error: "connection_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar conexão para obter token
    const { data: connection, error: connError } = await supabase
      .from("whatsapp_connections")
      .select("instance_id, api_token")
      .eq("id", connection_id)
      .single();

    if (connError || !connection) {
      throw new Error("Conexão não encontrada");
    }

    if (!connection.instance_id) {
      throw new Error("Instância não configurada para esta conexão");
    }

    const token = connection.api_token || globalToken;

    // Buscar telefones a validar
    const { data: phones, error: phonesError } = await supabase
      .from("contact_phones")
      .select("id, phone")
      .in("id", phone_ids);

    if (phonesError) {
      throw new Error("Erro ao buscar telefones");
    }

    if (!phones || phones.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum telefone encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: ValidationResult[] = [];
    const batchSize = 10;
    const delayBetweenBatches = 2000; // 2 segundos entre lotes

    // Processar em lotes para não sobrecarregar a API
    for (let i = 0; i < phones.length; i += batchSize) {
      const batch = phones.slice(i, i + batchSize);

      const batchPromises = batch.map(async (phoneRecord) => {
        try {
          // Formatar número (remover caracteres não numéricos)
          const cleanPhone = phoneRecord.phone.replace(/\D/g, "");
          
          // Verificar se número é válido (mínimo 10 dígitos para Brasil)
          if (cleanPhone.length < 10) {
            return {
              phone_id: phoneRecord.id,
              phone: phoneRecord.phone,
              is_whatsapp: false,
              phone_type: "invalid",
              error: "Número muito curto",
            };
          }

          // Adicionar código do país se não tiver
          const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

          // Chamar API UAZAPI para verificar número
          const response = await fetch(`${uazapiBaseUrl}/check-number`, {
            method: "POST",
            headers: {
              "token": token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ number: formattedPhone }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Erro ao verificar ${formattedPhone}:`, errorText);
            
            return {
              phone_id: phoneRecord.id,
              phone: phoneRecord.phone,
              is_whatsapp: false,
              phone_type: "unknown",
              error: `Erro na API: ${response.status}`,
            };
          }

          const data = await response.json();
          console.log(`Resultado para ${formattedPhone}:`, data);

          // Interpretar resposta da UAZAPI
          // A resposta pode variar, mas geralmente tem um campo indicando se é WhatsApp
          const isWhatsApp = data.exists === true || data.isWhatsapp === true || data.result === true;
          
          let phoneType = "unknown";
          if (isWhatsApp) {
            phoneType = "whatsapp";
          } else if (data.exists === false || data.isWhatsapp === false) {
            // Se a API confirma que não é WhatsApp, pode ser fixo ou inválido
            // Números com 8 dígitos locais geralmente são fixos
            const localNumber = cleanPhone.replace(/^55/, "").replace(/^\d{2}/, "");
            phoneType = localNumber.length === 8 ? "landline" : "invalid";
          }

          return {
            phone_id: phoneRecord.id,
            phone: phoneRecord.phone,
            is_whatsapp: isWhatsApp,
            phone_type: phoneType,
          };
        } catch (error) {
          console.error(`Erro ao processar ${phoneRecord.phone}:`, error);
          return {
            phone_id: phoneRecord.id,
            phone: phoneRecord.phone,
            is_whatsapp: false,
            phone_type: "unknown",
            error: error instanceof Error ? error.message : "Erro desconhecido",
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Delay entre lotes (exceto no último)
      if (i + batchSize < phones.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }

    // Atualizar telefones no banco de dados
    const updatePromises = results.map(async (result) => {
      const { error } = await supabase
        .from("contact_phones")
        .update({
          is_whatsapp: result.is_whatsapp,
          phone_type: result.phone_type,
          validated_at: new Date().toISOString(),
          validation_error: result.error || null,
        })
        .eq("id", result.phone_id);

      if (error) {
        console.error(`Erro ao atualizar telefone ${result.phone_id}:`, error);
      }
    });

    await Promise.all(updatePromises);

    // Resumo da validação
    const summary = {
      total: results.length,
      whatsapp: results.filter((r) => r.phone_type === "whatsapp").length,
      landline: results.filter((r) => r.phone_type === "landline").length,
      invalid: results.filter((r) => r.phone_type === "invalid").length,
      unknown: results.filter((r) => r.phone_type === "unknown").length,
    };

    console.log("Validação concluída:", summary);

    return new Response(
      JSON.stringify({ success: true, results, summary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro em validate-phone-number:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
