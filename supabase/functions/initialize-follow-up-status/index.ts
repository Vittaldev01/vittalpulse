import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { campaign_id } = await req.json();

    if (!campaign_id) {
      throw new Error('campaign_id é obrigatório');
    }

    console.log('🔄 [INITIALIZE] Inicializando follow-ups para campanha:', campaign_id);

    // Verificar se a campanha existe
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, list_id, empresa_id')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campanha não encontrada: ${campaignError?.message}`);
    }

    console.log('✅ [INITIALIZE] Campanha encontrada:', campaign.name);

    // Verificar se há follow-up flow ativo
    const { data: followUpFlow, error: flowError } = await supabase
      .from('follow_up_flows')
      .select('id, total_steps, is_active')
      .eq('campaign_id', campaign_id)
      .eq('is_active', true)
      .maybeSingle();

    if (flowError) {
      throw new Error(`Erro ao buscar follow-up flow: ${flowError.message}`);
    }

    if (!followUpFlow) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Esta campanha não possui follow-up configurado' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [INITIALIZE] Follow-up flow encontrado:', {
      flow_id: followUpFlow.id,
      total_steps: followUpFlow.total_steps,
    });

    // Buscar primeira mensagem para calcular next_message_at
    const { data: firstMessage, error: messageError } = await supabase
      .from('follow_up_messages')
      .select('days_after_previous, step_number')
      .eq('flow_id', followUpFlow.id)
      .eq('step_number', 1)
      .maybeSingle();

    if (messageError || !firstMessage) {
      throw new Error(`Erro ao buscar primeira mensagem do follow-up: ${messageError?.message}`);
    }

    console.log(`📅 [INITIALIZE] Primeira mensagem será enviada ${firstMessage.days_after_previous} dias após a campanha`);

    // Buscar todos os contatos da campanha
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, name, phone')
      .eq('list_id', campaign.list_id);

    if (contactsError || !contacts || contacts.length === 0) {
      throw new Error(`Erro ao buscar contatos: ${contactsError?.message}`);
    }

    console.log(`👥 [INITIALIZE] Encontrados ${contacts.length} contatos na lista`);

    // Verificar quais contatos já têm status
    const { data: existingStatuses, error: existingError } = await supabase
      .from('contact_follow_up_status')
      .select('contact_id')
      .eq('campaign_id', campaign_id);

    if (existingError) {
      throw new Error(`Erro ao verificar status existentes: ${existingError.message}`);
    }

    const existingContactIds = new Set(existingStatuses?.map(s => s.contact_id) || []);
    const contactsToCreate = contacts.filter(c => !existingContactIds.has(c.id));

    console.log(`📊 [INITIALIZE] Estatísticas:
- Total de contatos: ${contacts.length}
- Já têm status: ${existingContactIds.size}
- Faltam criar: ${contactsToCreate.length}`);

    if (contactsToCreate.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Todos os contatos já possuem follow-up status configurado',
          created: 0,
          existing: existingContactIds.size,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar sent_at da M1 para cada contato (usar timestamp da M1 como base)
    console.log(`🔍 [INITIALIZE] Buscando timestamps da M1 para ${contactsToCreate.length} contatos...`);
    
    const { data: m1Messages, error: m1Error } = await supabase
      .from('campaign_messages')
      .select('contact_id, sent_at')
      .eq('campaign_id', campaign_id)
      .eq('status', 'sent')
      .in('contact_id', contactsToCreate.map(c => c.id));

    if (m1Error) {
      console.error(`❌ [INITIALIZE] Erro ao buscar timestamps da M1:`, m1Error);
      throw new Error(`Erro ao buscar timestamps da M1: ${m1Error.message}`);
    }

    const m1SentMap = new Map();
    m1Messages?.forEach(msg => {
      m1SentMap.set(msg.contact_id, msg.sent_at);
    });

    console.log(`📅 [INITIALIZE] Encontrados ${m1SentMap.size} timestamps de M1`);

    // ✅ VALIDAÇÃO 1: Verificar se já existem registros ativos antes de criar
    console.log(`🔍 [INITIALIZE] Verificando registros ativos existentes para prevenir duplicação...`);
    
    const { data: activeRecords, error: activeRecordsError } = await supabase
      .from('contact_follow_up_status')
      .select('contact_id')
      .eq('campaign_id', campaign_id)
      .eq('is_active', true)
      .in('contact_id', contactsToCreate.map(c => c.id));

    if (activeRecordsError) {
      console.error('❌ [INITIALIZE] Erro ao verificar registros ativos:', activeRecordsError);
      throw new Error(`Erro ao verificar registros ativos: ${activeRecordsError.message}`);
    }

    // Filtrar contatos que já possuem registro ativo
    let finalContactsToCreate = contactsToCreate;
    
    if (activeRecords && activeRecords.length > 0) {
      const activeContactIds = new Set(activeRecords.map(r => r.contact_id));
      finalContactsToCreate = contactsToCreate.filter(c => !activeContactIds.has(c.id));
      
      console.log(`⚠️ [INITIALIZE] ${activeRecords.length} contatos já possuem registro ativo. Criando apenas ${finalContactsToCreate.length} novos registros.`);
      
      if (finalContactsToCreate.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Todos os contatos já possuem registros de follow-up ativos.',
            created_count: 0,
            existing_count: activeRecords.length
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // ✅ VALIDAÇÃO 2: CRÍTICA - Verificar se contatos já responderam à campanha
    console.log(`🔍 [INITIALIZE] Verificando contatos que já responderam à campanha...`);
    
    const { data: respondedContacts, error: responsesError } = await supabase
      .from('contact_responses')
      .select('contact_id')
      .eq('campaign_id', campaign_id)
      .in('contact_id', finalContactsToCreate.map(c => c.id));

    if (responsesError) {
      console.error('❌ [INITIALIZE] Erro ao verificar respostas:', responsesError);
      throw new Error(`Erro ao verificar respostas: ${responsesError.message}`);
    }

    // Filtrar contatos que já responderam
    let contactsWithoutResponse = finalContactsToCreate;
    let excludedByResponse = 0;
    
    if (respondedContacts && respondedContacts.length > 0) {
      const respondedContactIds = new Set(respondedContacts.map(r => r.contact_id));
      contactsWithoutResponse = finalContactsToCreate.filter(c => !respondedContactIds.has(c.id));
      excludedByResponse = respondedContacts.length;
      
      console.log(`⚠️ [INITIALIZE] ${excludedByResponse} contatos excluídos por já terem respondido à campanha.`);
      console.log(`✅ [INITIALIZE] ${contactsWithoutResponse.length} contatos válidos para receber follow-up.`);
      
      if (contactsWithoutResponse.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Todos os contatos válidos já responderam à campanha. Nenhum follow-up criado.',
            created_count: 0,
            existing_count: existingContactIds.size,
            excluded_by_response: excludedByResponse
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // Atualizar referência final
    finalContactsToCreate = contactsWithoutResponse;

    // Criar registros de follow-up para contatos sem status
    const followUpStatuses = finalContactsToCreate.map(contact => {
      // ✅ Usar timestamp da M1 como base (mantém HH:MM:SS exato)
      const m1SentAt = m1SentMap.get(contact.id);
      let nextMessageDate;
      
      if (m1SentAt) {
        // Adicionar exatos N dias mantendo hora:minuto:segundo da M1
        nextMessageDate = new Date(m1SentAt);
        nextMessageDate.setDate(nextMessageDate.getDate() + firstMessage.days_after_previous);
        console.log(`   ✅ ${contact.phone}: M1 em ${m1SentAt} → Follow-up em ${nextMessageDate.toISOString()}`);
      } else {
        // Fallback: se M1 ainda não foi enviada, usar AGORA
        nextMessageDate = new Date();
        nextMessageDate.setDate(nextMessageDate.getDate() + firstMessage.days_after_previous);
        console.log(`   ⚠️ ${contact.phone}: M1 não encontrada, usando AGORA como base`);
      }
      
      return {
        flow_id: followUpFlow.id,
        contact_id: contact.id,
        campaign_id: campaign_id,
        empresa_id: campaign.empresa_id,
        current_step: 1,
        is_active: true,
        next_message_at: nextMessageDate.toISOString(),
        last_message_sent_at: null,
        stopped_reason: null,
        stopped_at: null,
      };
    });

    console.log(`📝 [INITIALIZE] Criando ${followUpStatuses.length} novos registros...`);

    // Inserir em lotes de 100
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < followUpStatuses.length; i += batchSize) {
      const batch = followUpStatuses.slice(i, i + batchSize);
      const { data: insertedData, error: insertError } = await supabase
        .from('contact_follow_up_status')
        .insert(batch)
        .select('id');

      if (insertError) {
        console.error(`❌ [INITIALIZE] Erro ao inserir lote ${Math.floor(i / batchSize) + 1}:`, insertError);
        throw new Error(`Erro ao criar follow-up status: ${insertError.message}`);
      }

      insertedCount += insertedData?.length || 0;
      console.log(`✅ [INITIALIZE] Lote ${Math.floor(i / batchSize) + 1}: ${insertedData?.length || 0} registros criados`);
    }

    console.log(`🎉 [INITIALIZE] Inicialização completa!
- Registros criados: ${insertedCount}
- Registros já existentes: ${existingContactIds.size}
- Excluídos por resposta: ${excludedByResponse}
- Total de contatos com follow-up: ${insertedCount + existingContactIds.size}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Follow-ups inicializados com sucesso. ${excludedByResponse > 0 ? `${excludedByResponse} contatos excluídos por já terem respondido.` : ''}`,
        created: insertedCount,
        existing: existingContactIds.size,
        excluded_by_response: excludedByResponse,
        total: insertedCount + existingContactIds.size,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [INITIALIZE] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
