const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, part } = await req.json();

    if (!prompt || !part) {
      return new Response(
        JSON.stringify({ error: "Prompt e part são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openAIKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIKey) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    console.log(`Gerando variações para parte ${part}:`, prompt);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em copywriting para WhatsApp. Gere EXATAMENTE 7 variações DIFERENTES da mensagem solicitada. 

REGRAS CRÍTICAS:
- Cada variação deve ser única e criativa
- Mantenha o mesmo objetivo/intenção
- Varie o tom, estrutura e palavras
- Use linguagem natural e conversacional
- Retorne APENAS um array JSON com 7 strings
- NÃO adicione números, marcadores ou formatação extra
- Cada variação deve ser uma string completa

Formato de resposta: ["variação 1", "variação 2", "variação 3", "variação 4", "variação 5", "variação 6", "variação 7"]`,
          },
          {
            role: "user",
            content: `Crie 7 variações para: ${prompt}`,
          },
        ],
        temperature: 0.9,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI error:", response.status, errorText);
      throw new Error(`Erro na API OpenAI: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    console.log("Resposta da OpenAI:", content);

    // Parse the JSON array from the response
    let variations: string[];
    try {
      variations = JSON.parse(content);
    } catch (parseError) {
      console.error("Erro ao parsear resposta:", content);
      throw new Error("Formato de resposta inválido da IA");
    }

    if (!Array.isArray(variations) || variations.length !== 7) {
      throw new Error("A IA não retornou exatamente 7 variações");
    }

    console.log("Variações geradas com sucesso:", variations.length);

    return new Response(
      JSON.stringify({ variations }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro em generate-variations:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
