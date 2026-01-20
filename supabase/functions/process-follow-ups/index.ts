import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===========================
// HELPER FUNCTIONS PARA LOCK
// ===========================

async function cleanExpiredLocks(supabase: any) {
  const expiredTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await supabase
    .from('campaign_processing_lock')
    .delete()
    .lt('locked_at', expiredTime)
    .eq('process_type', 'followup');
}

async function tryAcquireLock(supabase: any, campaignId: string): Promise<boolean> {
  const lockId = `followup-${Date.now()}`;
  
  const { data, error } = await supabase
    .from('campaign_processing_lock')
    .insert({
      campaign_id: campaignId,
      locked_by: lockId,
      process_type: 'followup',
      locked_at: new Date().toISOString(),
    })
    .select();

  if (error) {
    if (error.code === '23505') {
      console.log(`⏳ Follow-ups da campanha ${campaignId} já estão sendo processados`);
      return false;
    }
    throw error;
  }

  console.log(`🔒 Lock adquirido para follow-ups da campanha ${campaignId}`);
  return true;
}

async function releaseLock(supabase: any, campaignId: string) {
  await supabase
    .from('campaign_processing_lock')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('process_type', 'followup');
  
  console.log(`🔓 Lock liberado para follow-ups da campanha ${campaignId}`);
}

// ===========================
// MAIN HANDLER
// ===========================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Processando follow-ups...');

    // Limpar locks expirados
    await cleanExpiredLocks(supabase);

    // Buscar campanhas com follow-ups ativos
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, allowed_hours_start, allowed_hours_end, allowed_days, min_interval_seconds, max_interval_seconds, pause_after_messages, pause_duration_minutes, next_batch_at')
      .in('status', ['running', 'paused', 'completed'])
      .or('next_batch_at.is.null,next_batch_at.lt.' + new Date().toISOString());

    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhuma campanha com follow-ups' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const campaign of campaigns) {
      try {
        await processCampaignFollowUps(supabase, campaign);
      } catch (error) {
        console.error(`❌ Erro ao processar follow-ups da campanha ${campaign.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Follow-ups processados' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// ===========================
// PROCESS CAMPAIGN FOLLOW-UPS
// ===========================

async function processCampaignFollowUps(supabase: any, campaign: any) {
  console.log(`\n📋 Processando follow-ups da campanha: ${campaign.name}`);

  // Verificar se está em pausa (aguardando próximo batch)
  if (campaign.next_batch_at) {
    const nextBatch = new Date(campaign.next_batch_at);
    const now = new Date();
    if (now < nextBatch) {
      console.log(`⏳ Follow-ups em pausa até ${nextBatch.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
      return;
    }
  }

  // Tentar adquirir lock
  const hasLock = await tryAcquireLock(supabase, campaign.id);
  if (!hasLock) {
    return;
  }

  try {
    // Buscar follow-ups prontos para envio
    const { data: followUpStatuses } = await supabase
      .from('contact_follow_up_status')
      .select(`
        *,
        follow_up_flows(*),
        contacts(
          name,
          phone,
          preferred_connection_id,
          preferred_connection:whatsapp_connections!preferred_connection_id(
            id, name, instance_id, api_token, status
          )
        )
      `)
      .eq('campaign_id', campaign.id)
      .eq('is_active', true)
      .lte('next_message_at', new Date().toISOString())
      .limit(20); // Batch de 20 por vez

    if (!followUpStatuses || followUpStatuses.length === 0) {
      console.log(`✅ Nenhum follow-up pronto para envio`);
      return;
    }

    console.log(`📤 ${followUpStatuses.length} follow-ups prontos`);

    // Configurações de delay
    const minSeconds = campaign.min_interval_seconds || 30;
    const maxSeconds = campaign.max_interval_seconds || 60;
    const pauseAfter = campaign.pause_after_messages || 20;
    const pauseDuration = campaign.pause_duration_minutes || 10;

    let messagesSent = 0;

    for (const status of followUpStatuses) {
      // Verificar se atingiu limite de pausa
      if (messagesSent >= pauseAfter) {
        const nextBatchTime = new Date(Date.now() + pauseDuration * 60 * 1000);
        
        await supabase
          .from('campaigns')
          .update({ next_batch_at: nextBatchTime.toISOString() })
          .eq('id', campaign.id);
        
        console.log(`⏸️ Batch de ${pauseAfter} follow-ups completo. Próximo batch às ${nextBatchTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
        break; // Sair do loop, próxima invocação continuará
      }

      // Verificar horário permitido
      if (!isWithinAllowedTime(campaign.allowed_hours_start, campaign.allowed_hours_end, campaign.allowed_days)) {
        console.log('⏰ Fora do horário permitido');
        break;
      }

      // Processar follow-up
      const sent = await processFollowUp(supabase, status);
      
      if (sent) {
        messagesSent++;
        
        // Delay aleatório antes da próxima mensagem
        const randomDelay = Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
        console.log(`⏱️ Aguardando ${randomDelay}s até próxima mensagem...`);
        await new Promise(resolve => setTimeout(resolve, randomDelay * 1000));
      }
    }

  } finally {
    await releaseLock(supabase, campaign.id);
  }
}

// ===========================
// PROCESS FOLLOW-UP
// ===========================

async function processFollowUp(supabase: any, status: any): Promise<boolean> {
  const contact = status.contacts;
  const preferredConnection = contact.preferred_connection;

  console.log(`\n📊 Follow-up ${status.id} - ${contact.name}`);

  // Validar chip preferencial
  if (!preferredConnection || preferredConnection.status !== 'connected') {
    console.log(`❌ Chip preferencial inválido ou desconectado`);
    await deactivateFollowUp(supabase, status.id, 'Chip preferencial inválido');
    return false;
  }
  
  // Verificar status REAL antes de enviar
  const isReallyConnected = await checkConnectionRealStatus(preferredConnection);
  if (!isReallyConnected) {
    console.log(`❌ Chip ${preferredConnection.name} desconectado! Pausando campanha.`);
    
    // Pausar campanha
    await supabase
      .from('campaigns')
      .update({ 
        status: 'paused',
        pause_reason: 'chip_disconnected'
      })
      .eq('id', status.campaign_id);
    
    // Atualizar status do chip no banco
    await supabase
      .from('whatsapp_connections')
      .update({ status: 'disconnected' })
      .eq('id', preferredConnection.id);
    
    return false;
  }

  // Verificar se contato já respondeu
  const { data: existingResponses } = await supabase
    .from('contact_responses')
    .select('id')
    .eq('campaign_id', status.campaign_id)
    .eq('contact_id', contact.id)
    .gte('received_at', status.created_at)
    .limit(1);

  if (existingResponses && existingResponses.length > 0) {
    console.log(`⏸️ Contato já respondeu. Pausando follow-up.`);
    await deactivateFollowUp(supabase, status.id, 'Contato respondeu à campanha');
    return false;
  }

  // Atualizar next_message_at ANTES de enviar (prevenir race condition)
  const isLastStep = status.current_step >= status.follow_up_flows.total_steps;
  const nextStep = status.current_step + 1;

  let nextMessageAt = null;
  if (!isLastStep) {
    const { data: nextMessage } = await supabase
      .from('follow_up_messages')
      .select('days_after_previous')
      .eq('flow_id', status.flow_id)
      .eq('step_number', nextStep)
      .single();

    if (nextMessage) {
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + nextMessage.days_after_previous);
      nextMessageAt = baseDate.toISOString();
    }
  }

  // Bloquear reprocessamento
  const preventReprocessDate = nextMessageAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from('contact_follow_up_status')
    .update({ next_message_at: preventReprocessDate })
    .eq('id', status.id);

  // Buscar mensagens do follow-up
  const { data: followUpMessage } = await supabase
    .from('follow_up_messages')
    .select('*')
    .eq('flow_id', status.flow_id)
    .eq('step_number', status.current_step)
    .single();

  if (!followUpMessage) {
    await deactivateFollowUp(supabase, status.id, 'Mensagem não encontrada');
    return false;
  }

  const messages = followUpMessage.messages;
  if (!messages || typeof messages !== 'object') {
    await deactivateFollowUp(supabase, status.id, 'Mensagens inválidas');
    return false;
  }

  // Enviar part1
  const part1Variations = messages.part1 || [];
  if (part1Variations.length === 0) {
    await deactivateFollowUp(supabase, status.id, 'Sem variações disponíveis');
    return false;
  }

  const randomIndex1 = Math.floor(Math.random() * part1Variations.length);
  const selectedVariation1 = part1Variations[randomIndex1];

  const sent1 = await sendMessage(supabase, status, selectedVariation1, 1);
  if (!sent1) {
    await deactivateFollowUp(supabase, status.id, 'Erro ao enviar part1');
    return false;
  }

  // Enviar part2 se existir
  const part2Variations = messages.part2 || [];
  if (part2Variations.length > 0) {
    console.log('⏳ Aguardando 3s para enviar part2...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const randomIndex2 = Math.floor(Math.random() * part2Variations.length);
    const selectedVariation2 = part2Variations[randomIndex2];
    await sendMessage(supabase, status, selectedVariation2, 2);
  }

  // Atualizar status final
  const nowTimestamp = new Date().toISOString();
  await supabase
    .from('contact_follow_up_status')
    .update({
      current_step: nextStep,
      is_active: !isLastStep,
      last_message_sent_at: nowTimestamp,
      next_message_at: nextMessageAt,
      stopped_at: isLastStep ? nowTimestamp : null,
      stopped_reason: isLastStep ? 'Fluxo completo' : null,
    })
    .eq('id', status.id);

  console.log(`✅ Follow-up enviado com sucesso`);
  return true;
}

// ===========================
// CHECK CONNECTION REAL STATUS
// ===========================

async function checkConnectionRealStatus(connection: any): Promise<boolean> {
  try {
    const baseUrl = Deno.env.get('UAZAPI_BASE_URL');
    const globalToken = Deno.env.get('UAZAPI_TOKEN');
    const apiToken = connection.api_token || globalToken;
    
    const response = await fetch(`${baseUrl}/instance/status?instanceId=${connection.instance_id}`, {
      method: 'GET',
      headers: {
        'token': apiToken
      }
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.status?.connected === true && data.status?.loggedIn === true;
  } catch {
    return false;
  }
}

// ===========================
// SEND MESSAGE
// ===========================

async function sendMessage(supabase: any, status: any, variation: any, part: number): Promise<boolean> {
  try {
    let messageText = '';
    let mediaUrl = null;
    let mediaType = null;

    if (typeof variation === 'string') {
      messageText = variation;
    } else if (typeof variation === 'object') {
      messageText = variation.text || '';
      mediaUrl = variation.mediaUrl || null;
      mediaType = variation.mediaType || null;
    }

    const contact = status.contacts;
    messageText = messageText
      .replace(/\{\{nome\}\}/g, contact.name)
      .replace(/\{\{telefone\}\}/g, contact.phone);

    const preferredConnection = contact.preferred_connection;
    const uazapiUrl = Deno.env.get('UAZAPI_BASE_URL')!;
    const globalToken = Deno.env.get('UAZAPI_TOKEN')!;
    const apiToken = preferredConnection.api_token || globalToken;
    const cleanPhone = String(contact.phone).replace(/\D/g, '');

    let endpoint = `${uazapiUrl}/send/text`;
    let body: any = {
      number: cleanPhone,
      text: messageText,
    };

    if (mediaUrl) {
      endpoint = `${uazapiUrl}/send/media`;
      
      if (!mediaType || mediaType === 'none') {
        const urlLower = String(mediaUrl).toLowerCase();
        if (urlLower.match(/\.(mp4|mov|m4v)$/)) mediaType = 'video';
        else if (urlLower.match(/\.(pdf)$/)) mediaType = 'document';
        else if (urlLower.match(/\.(mp3|wav|ogg)$/)) mediaType = 'audio';
        else mediaType = 'image';
      }
      
      body = {
        number: cleanPhone,
        type: mediaType,
        file: mediaUrl,
        text: messageText || '',
      };
    }

    console.log(`📤 Enviando part${part} via ${preferredConnection.name}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': apiToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ Erro ao enviar: ${errorData}`);
      return false;
    }

    console.log(`✅ Part${part} enviada com sucesso`);
    return true;

  } catch (error) {
    console.error(`❌ Erro ao enviar part${part}:`, error);
    return false;
  }
}

// ===========================
// HELPERS
// ===========================

async function deactivateFollowUp(supabase: any, statusId: string, reason: string) {
  await supabase
    .from('contact_follow_up_status')
    .update({
      is_active: false,
      stopped_at: new Date().toISOString(),
      stopped_reason: reason,
    })
    .eq('id', statusId);
  
  console.log(`⏸️ Follow-up desativado: ${reason}`);
}

function isWithinAllowedTime(startTime: string, endTime: string, allowedDays: any): boolean {
  const now = new Date();
  const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const currentHour = brasiliaTime.toTimeString().slice(0, 8);
  const currentDay = brasiliaTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  if (startTime && endTime) {
    const timeToSeconds = (time: string) => {
      const [h, m, s] = time.split(':').map(Number);
      return h * 3600 + m * 60 + (s || 0);
    };
    
    const currentSeconds = timeToSeconds(currentHour);
    const startSeconds = timeToSeconds(startTime);
    const endSeconds = timeToSeconds(endTime);
    
    if (currentSeconds < startSeconds || currentSeconds > endSeconds) {
      return false;
    }
  }

  const parseAllowedDays = (value: any): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.startsWith('[')) {
        try { return JSON.parse(trimmed); } catch { return []; }
      }
      return trimmed.split(',').map((d: string) => d.trim()).filter(Boolean);
    }
    return [];
  };

  const allowedDaysList = parseAllowedDays(allowedDays);
  if (allowedDaysList.length > 0 && !allowedDaysList.includes(currentDay)) {
    return false;
  }

  return true;
}
