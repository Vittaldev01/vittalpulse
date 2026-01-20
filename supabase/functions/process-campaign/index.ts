import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MediaItem {
  url: string;
  type: "image" | "video" | "audio" | "document";
  name?: string;
}

interface Message {
  text: string;
  media_url?: string;
  media_type?: string;
  media_items?: MediaItem[];
}

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

    console.log('Processando campanha:', campaign_id);

    // Buscar campanha
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*, whatsapp_connections(id, name), empresa_id')
      .eq('id', campaign_id)
      .single();

    if (campaignError) throw campaignError;
    if (!campaign) throw new Error('Campanha não encontrada');

    // Verificar se a campanha já foi processada (tem mensagens)
    const { data: existingMessages, error: messagesCheckError } = await supabase
      .from('campaign_messages')
      .select('id')
      .eq('campaign_id', campaign_id)
      .limit(1);

    if (messagesCheckError) throw messagesCheckError;
    
    if (existingMessages && existingMessages.length > 0) {
      console.log('⚠️ Campanha já foi processada anteriormente. Ignorando invocação duplicada.');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Campanha já foi processada anteriormente',
          already_processed: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar contatos da lista
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, name, phone')
      .eq('list_id', campaign.list_id);

    if (contactsError) throw contactsError;
    if (!contacts || contacts.length === 0) {
      throw new Error('Nenhum contato encontrado na lista');
    }

    console.log(`Encontrados ${contacts.length} contatos`);

    // Parse das mensagens
    const messages = JSON.parse(campaign.messages);
    const part1Messages: Message[] = messages.part1 || [];
    const part2Messages: Message[] = messages.part2 || [];

    if (part1Messages.length === 0) {
      throw new Error('Nenhuma mensagem configurada');
    }

    // Criar registros de campaign_messages
    const campaignMessages: any[] = [];
    
    contacts.forEach(contact => {
      // Selecionar variações aleatórias
      const part1Index = Math.floor(Math.random() * part1Messages.length);
      const part1 = part1Messages[part1Index];

      // Mensagem Parte 1
      let messageText1 = part1.text
        .replace(/\{\{nome\}\}/g, contact.name)
        .replace(/\{\{telefone\}\}/g, contact.phone);

      // Prepare media_items array
      let mediaItems1: MediaItem[] | null = null;
      if (part1.media_items && part1.media_items.length > 0) {
        mediaItems1 = part1.media_items;
      } else if (part1.media_url && part1.media_type && part1.media_type !== 'none') {
        // Backwards compatibility with legacy single media format
        mediaItems1 = [{
          url: part1.media_url,
          type: (part1.media_type as "image" | "video" | "audio" | "document")
        }];
      }

      campaignMessages.push({
        campaign_id,
        contact_id: contact.id,
        empresa_id: campaign.empresa_id,
        message_text: messageText1,
        part1_variation: part1Index + 1,
        part2_variation: null,
        media_url: mediaItems1 && mediaItems1.length > 0 ? mediaItems1[0].url : null,
        media_items: mediaItems1,
        message_part: 1,
        status: 'pending',
      });

      // Mensagem Parte 2 (APENAS para campanhas 'simple')
      // Para campanhas 'interactive', M2 será criada dinamicamente pelo process-interactive-messages
      if (campaign.campaign_type !== 'interactive' && part2Messages.length > 0) {
        const part2Index = Math.floor(Math.random() * part2Messages.length);
        const part2 = part2Messages[part2Index];

        let messageText2 = part2.text
          .replace(/\{\{nome\}\}/g, contact.name)
          .replace(/\{\{telefone\}\}/g, contact.phone);

        // Prepare media_items for part 2
        let mediaItems2: MediaItem[] | null = null;
        if (part2.media_items && part2.media_items.length > 0) {
          mediaItems2 = part2.media_items;
        } else if (part2.media_url && part2.media_type && part2.media_type !== 'none') {
          mediaItems2 = [{
            url: part2.media_url,
            type: (part2.media_type as "image" | "video" | "audio" | "document")
          }];
        }

        campaignMessages.push({
          campaign_id,
          contact_id: contact.id,
          empresa_id: campaign.empresa_id,
          message_text: messageText2,
          part1_variation: null,
          part2_variation: part2Index + 1,
          media_url: mediaItems2 && mediaItems2.length > 0 ? mediaItems2[0].url : null,
          media_items: mediaItems2,
          message_part: 2,
          status: 'pending',
        });
      }
    });

    console.log(`📝 [${campaign.campaign_type}] Criando mensagens:`, {
      tipo: campaign.campaign_type,
      total_contatos: contacts.length,
      total_mensagens: campaignMessages.length,
      mensagens_por_contato: campaign.campaign_type === 'interactive' ? 'M1 apenas (M2 será enviada após resposta)' : 'M1 + M2'
    });

    // Inserir em lotes de 100
    const batchSize = 100;
    for (let i = 0; i < campaignMessages.length; i += batchSize) {
      const batch = campaignMessages.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('campaign_messages')
        .insert(batch);

      if (insertError) {
        console.error('Erro ao inserir lote:', insertError);
        throw insertError;
      }
    }

    const totalInserted = campaignMessages.length;
    console.log(`${totalInserted} mensagens criadas`);

    // 🆕 CRIAR REGISTROS DE INTERACTION STATUS PARA CAMPANHAS INTERATIVAS
    if (campaign.campaign_type === 'interactive') {
      console.log('💬 [Interactive] Detectada campanha interativa, criando registros de status...');
      
      const interactionStatuses = contacts.map(contact => ({
        campaign_id: campaign_id,
        contact_id: contact.id,
        empresa_id: campaign.empresa_id,
        current_stage: 'waiting_message1',
        flow_completed: false,
        followup_started: false,
      }));

      // Inserir em lotes
      for (let i = 0; i < interactionStatuses.length; i += batchSize) {
        const batch = interactionStatuses.slice(i, i + batchSize);
        const { error: statusError } = await supabase
          .from('contact_interaction_status')
          .insert(batch);

        if (statusError) {
          console.error('❌ [Interactive] Erro ao criar interaction status:', statusError);
          throw statusError;
        }
      }

      console.log(`✅ [Interactive] ${interactionStatuses.length} registros de status criados`);
    }

    // Inicializar sistema de follow-up se configurado
    console.log('🔍 [FOLLOW-UP] Verificando se há follow-ups configurados para campanha:', campaign_id);

    // Implementar retry logic (3 tentativas com 2s de intervalo)
    let followUpFlow = null;
    let attempts = 0;
    const maxAttempts = 3;
    const retryDelay = 2000; // 2 segundos

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 [FOLLOW-UP] Tentativa ${attempts}/${maxAttempts} de buscar flow...`);

      const { data, error: flowError } = await supabase
        .from('follow_up_flows')
        .select('id, total_steps, is_active')
        .eq('campaign_id', campaign_id)
        .eq('is_active', true)
        .maybeSingle();

      if (flowError) {
        console.error(`❌ [FOLLOW-UP] Erro na tentativa ${attempts}:`, flowError);
        if (attempts === maxAttempts) {
          throw new Error(`Erro ao buscar follow-up flow após ${maxAttempts} tentativas: ${flowError.message}`);
        }
      } else if (data) {
        followUpFlow = data;
        console.log(`✅ [FOLLOW-UP] Flow encontrado na tentativa ${attempts}:`, {
          flow_id: data.id,
          total_steps: data.total_steps,
          is_active: data.is_active
        });
        break;
      } else {
        console.log(`⚠️ [FOLLOW-UP] Nenhum flow encontrado na tentativa ${attempts}`);
      }

      // Aguardar antes da próxima tentativa (exceto na última)
      if (attempts < maxAttempts) {
        console.log(`⏳ [FOLLOW-UP] Aguardando ${retryDelay/1000}s antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (!followUpFlow) {
      console.log('ℹ️ [FOLLOW-UP] Nenhum flow ativo encontrado após todas as tentativas');
    } else {
      console.log(`✅ [FOLLOW-UP] Flow encontrado:`, {
        flow_id: followUpFlow.id,
        total_steps: followUpFlow.total_steps,
        is_active: followUpFlow.is_active
      });
      
      // Buscar primeira mensagem de follow-up para calcular quando enviar
      const { data: firstMessage, error: messageError } = await supabase
        .from('follow_up_messages')
        .select('days_after_previous, step_number')
        .eq('flow_id', followUpFlow.id)
        .eq('step_number', 1)
        .maybeSingle();

      if (messageError) {
        console.error('❌ [FOLLOW-UP] Erro ao buscar primeira mensagem:', messageError);
        throw new Error(`Erro ao buscar primeira mensagem: ${messageError.message}`);
      }

      if (!firstMessage) {
        console.log('⚠️ [FOLLOW-UP] Flow existe mas não tem mensagens configuradas');
      } else {
        console.log(`📅 [FOLLOW-UP] Primeira mensagem será enviada ${firstMessage.days_after_previous} dias após a campanha`);
        
        // Criar registros de follow-up para cada contato
        const followUpStatuses = contacts.map(contact => {
          const nextMessageDate = new Date();
          nextMessageDate.setDate(nextMessageDate.getDate() + firstMessage.days_after_previous);
          
          return {
            flow_id: followUpFlow.id,
            contact_id: contact.id,
            campaign_id: campaign_id,
            current_step: 1,
            is_active: true,
            next_message_at: nextMessageDate.toISOString(),
            last_message_sent_at: null,
            stopped_reason: null,
            stopped_at: null,
          };
        });

        console.log(`📝 [FOLLOW-UP] Criando ${followUpStatuses.length} registros de follow-up status...`);

        // Inserir em lotes
        let insertedCount = 0;
        for (let i = 0; i < followUpStatuses.length; i += batchSize) {
          const batch = followUpStatuses.slice(i, i + batchSize);
          const { data: insertedData, error: followUpError } = await supabase
            .from('contact_follow_up_status')
            .insert(batch)
            .select('id');

          if (followUpError) {
            console.error(`❌ [FOLLOW-UP] Erro ao criar lote ${Math.floor(i / batchSize) + 1}:`, followUpError);
            throw new Error(`Erro ao criar follow-up status: ${followUpError.message}`);
          }

          insertedCount += insertedData?.length || 0;
          console.log(`✅ [FOLLOW-UP] Lote ${Math.floor(i / batchSize) + 1}: ${insertedData?.length || 0} registros inseridos`);
        }

        console.log(`🎉 [FOLLOW-UP] Total de ${insertedCount} registros de follow-up criados com sucesso`);
      }
    }

    // 🆕 FASE 3: Atualizar campanha com total REAL de mensagens criadas
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        total_messages: totalInserted, // Total real de mensagens criadas
      })
      .eq('id', campaign_id);

    if (updateError) throw updateError;

    console.log(`✅ Campanha iniciada. Total de mensagens: ${totalInserted} (${campaign.campaign_type === 'interactive' ? 'apenas M1, M2 será criada após resposta' : 'M1 + M2'})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total_messages: contacts.length,
        message: 'Campanha processada e iniciada com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao processar campanha:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
