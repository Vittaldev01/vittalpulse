import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, count = 7 } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log('Gerando variações com IA...', { prompt, count });

    // Chamar Lovable AI Gateway com structured output
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em copywriting para WhatsApp. Gere ${count} variações diferentes e persuasivas da mensagem fornecida. 
            
Regras importantes:
- Cada variação deve ter o mesmo objetivo e tom, mas usar palavras e estruturas diferentes
- Mantenha a naturalidade e o estilo conversacional do WhatsApp
- Use emojis quando apropriado
- Cada variação deve ter entre 2 e 4 linhas
- Mantenha variáveis como {{nome}} e {{telefone}} exatamente como aparecem no prompt original`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_variations',
              description: `Retorna exatamente ${count} variações da mensagem`,
              parameters: {
                type: 'object',
                properties: {
                  variations: {
                    type: 'array',
                    items: {
                      type: 'string'
                    },
                    description: `Array com exatamente ${count} variações da mensagem`
                  }
                },
                required: ['variations'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_variations' } },
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos em Configurações > Workspace > Usage.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Erro ao gerar variações: ${response.status}`);
    }

    const data = await response.json();
    
    // Extrair variações do tool call
    const toolCall = data.choices[0].message.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'generate_variations') {
      throw new Error('Formato de resposta inválido da IA');
    }
    
    const functionArgs = JSON.parse(toolCall.function.arguments);
    const variations = functionArgs.variations.slice(0, count);

    console.log(`${variations.length} variações geradas com sucesso`);

    return new Response(
      JSON.stringify({ variations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao gerar variações:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido ao gerar variações' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});