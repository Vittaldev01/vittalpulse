import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Verifica se todos os contatos da campanha completaram o fluxo interativo
 * Se sim, marca a campanha como completed
 */
async function checkCampaignCompletion(supabase: any, campaignId: string) {
  // Contar total de contatos
  const { count: totalContacts } = await supabase
    .from('contact_interaction_status')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);

  // Contar contatos que completaram
  const { count: completedContacts } = await supabase
    .from('contact_interaction_status')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('flow_completed', true);

  console.log(`📊 [Completion Check] Campanha ${campaignId}: ${completedContacts}/${totalContacts} completados`);

  // Se TODOS completaram, marcar campanha como completed
  if (completedContacts === totalContacts && totalContacts > 0) {
    const { error } = await supabase
      .from('campaigns')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', campaignId);

    if (!error) {
      console.log(`✅ [Interactive] Campanha ${campaignId} marcada como completed (todos os contatos finalizaram)`);
    }
  }
}

interface Message {
  text: string;
  media_url?: string;
  media_type?: string;
}

/**
 * Verificar status REAL da conexão na UAZAPI
 */
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const uazapiBaseUrl = Deno.env.get('UAZAPI_BASE_URL')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 [Interactive] Processando campanhas interativas...');

    // Buscar campanhas interativas (running ou paused - paused ainda precisa enviar M2 e processar timeouts)
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, status, interaction_config, allowed_hours_start, allowed_hours_end, allowed_days, messages, empresa_id')
      .eq('campaign_type', 'interactive')
      .in('status', ['running', 'paused']);

    if (campaignsError) throw campaignsError;
    
    if (!campaigns || campaigns.length === 0) {
      console.log('ℹ️ [Interactive] Nenhuma campanha interativa em execução');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhuma campanha interativa em execução' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 [Interactive] Encontradas ${campaigns.length} campanhas interativas`);

    let totalProcessed = 0;
    let totalSent = 0;
    let totalTimeouts = 0;

    for (const campaign of campaigns) {
      console.log(`\n📋 [Interactive] Processando campanha: ${campaign.name} (${campaign.id})`);
      
      const config = campaign.interaction_config || { delay_after_response_seconds: 10, timeout_hours: 24 };
      const messages = JSON.parse(campaign.messages);
      const message1List: Message[] = messages.part1 || [];
      const message2List: Message[] = messages.part2 || [];

      // FASE 1: Enviar Mensagem 1 (batch de 10) - APENAS para campanhas running
      if (campaign.status === 'running') {
        const { data: waitingM1, error: m1Error } = await supabase
          .from('contact_interaction_status')
          .select(`
            id,
            contact_id,
            campaign_id,
            contacts!inner (
              id,
              name,
              phone,
              preferred_connection_id,
              whatsapp_connections!preferred_connection_id (
                id,
                name,
                api_token,
                instance_id,
                status
              )
            )
          `)
          .eq('campaign_id', campaign.id)
          .eq('current_stage', 'waiting_message1')
          .limit(10);

        if (m1Error) {
          console.error(`❌ [Interactive] Erro ao buscar waiting_message1:`, m1Error);
          continue;
        }

        console.log(`📤 [Interactive] ${waitingM1?.length || 0} contatos aguardando M1`);

      if (waitingM1 && waitingM1.length > 0) {
        for (const status of waitingM1) {
          const contact = status.contacts as any;
          const connection = contact.whatsapp_connections as any;

          if (!connection || connection.status !== 'connected') {
            console.log(`⚠️ [Interactive] Contato ${contact.name} sem conexão ativa`);
            continue;
          }
          
          // Verificar status REAL antes de enviar
          const isReallyConnected = await checkConnectionRealStatus(connection);
          if (!isReallyConnected) {
            console.log(`❌ [Interactive] Chip ${connection.name} desconectado! Pausando campanha.`);
            
            const supabase = await createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
            await supabase
              .from('campaigns')
              .update({ 
                status: 'paused',
                pause_reason: 'chip_disconnected'
              })
              .eq('id', campaign.id);
            
            // Atualizar status do chip no banco
            await supabase
              .from('whatsapp_connections')
              .update({ status: 'disconnected' })
              .eq('id', connection.id);
            
            break; // Parar processamento desta campanha
          }

          // Verificar horário permitido
          if (!isWithinAllowedTime(campaign.allowed_hours_start, campaign.allowed_hours_end, campaign.allowed_days)) {
            console.log(`⏰ [Interactive] Fora do horário permitido`);
            break;
          }

          // Selecionar variação aleatória da M1
          const m1Index = Math.floor(Math.random() * message1List.length);
          const m1 = message1List[m1Index];
          
          let messageText = m1.text
            .replace(/\{\{nome\}\}/g, contact.name)
            .replace(/\{\{telefone\}\}/g, contact.phone);

          // Enviar M1
          const sent = await sendMessage(
            uazapiBaseUrl,
            connection.instance_id,
            connection.api_token,
            contact.phone,
            messageText,
            m1.media_url,
            m1.media_type
          );

          if (sent) {
            // 1️⃣ Atualizar campaign_messages para 'sent'
            await supabase
              .from('campaign_messages')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                used_connection_id: connection.id,
              })
              .eq('campaign_id', campaign.id)
              .eq('contact_id', contact.id)
              .eq('message_part', 1)
              .eq('status', 'pending');

            // 2️⃣ Incrementar sent_messages do campaign
            await supabase.rpc('increment_sent_messages', { campaign_id: campaign.id });

            // 3️⃣ Atualizar interaction_status
            await supabase
              .from('contact_interaction_status')
              .update({
                current_stage: 'waiting_message1_response',
                message1_sent_at: new Date().toISOString(),
              })
              .eq('id', status.id);

            console.log(`✅ [Interactive] M1 enviada e sincronizada para ${contact.name}`);
            totalSent++;
          }
        }
      }
      } else {
        console.log(`⏸️ [Interactive] Campanha pausada - pulando envio de M1`);
      }

      // FASE 2: Enviar Mensagem 2 (após delay) - PROCESSA SEMPRE (mesmo paused)
      const delayMs = config.delay_after_response_seconds * 1000;
      const cutoffTime = new Date(Date.now() - delayMs).toISOString();

      const { data: waitingM2, error: m2Error } = await supabase
        .from('contact_interaction_status')
        .select(`
          id,
          contact_id,
          campaign_id,
          message1_response_received_at,
          contacts!inner (
            id,
            name,
            phone,
            preferred_connection_id,
            whatsapp_connections!preferred_connection_id (
              id,
              name,
              api_token,
              instance_id,
              status
            )
          )
        `)
        .eq('campaign_id', campaign.id)
        .eq('current_stage', 'waiting_message2')
        .lte('message1_response_received_at', cutoffTime)
        .limit(10);

      if (m2Error) {
        console.error(`❌ [Interactive] Erro ao buscar waiting_message2:`, m2Error);
        continue;
      }

      console.log(`📤 [Interactive] ${waitingM2?.length || 0} contatos aguardando M2`);

      if (waitingM2 && waitingM2.length > 0) {
        for (const status of waitingM2) {
          const contact = status.contacts as any;
          const connection = contact.whatsapp_connections as any;

          if (!connection || connection.status !== 'connected') {
            console.log(`⚠️ [Interactive] Contato ${contact.name} sem conexão ativa`);
            continue;
          }

          // ℹ️ NÃO verificar horário permitido para M2 - é resposta automática à interação do usuário
          // M2 deve ser enviada após o delay configurado, independentemente do horário

          // Selecionar variação aleatória da M2
          const m2Index = Math.floor(Math.random() * message2List.length);
          const m2 = message2List[m2Index];
          
          let messageText = m2.text
            .replace(/\{\{nome\}\}/g, contact.name)
            .replace(/\{\{telefone\}\}/g, contact.phone);

          // 1️⃣ CRIAR registro de M2 em campaign_messages
          const { data: newMessage, error: insertError } = await supabase
            .from('campaign_messages')
            .insert({
              campaign_id: campaign.id,
              contact_id: contact.id,
              empresa_id: campaign.empresa_id,
              message_text: messageText,
              part1_variation: null,
              part2_variation: m2Index + 1,
              media_url: m2.media_url || null,
              message_part: 2,
              status: 'pending',
            })
            .select()
            .single();

          if (insertError) {
            console.error(`❌ [Interactive] Erro ao criar M2 para ${contact.name}:`, insertError);
            continue;
          }

          // 2️⃣ ENVIAR M2
          const sent = await sendMessage(
            uazapiBaseUrl,
            connection.instance_id,
            connection.api_token,
            contact.phone,
            messageText,
            m2.media_url,
            m2.media_type
          );

          if (sent) {
            // 3️⃣ ATUALIZAR campaign_messages como 'sent'
            await supabase
              .from('campaign_messages')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                used_connection_id: connection.id,
              })
              .eq('id', newMessage.id);

            // 4️⃣ ATUALIZAR interaction_status
            await supabase
              .from('contact_interaction_status')
              .update({
                current_stage: 'waiting_message2_response',
                message2_sent_at: new Date().toISOString(),
              })
              .eq('id', status.id);

            console.log(`✅ [Interactive] M2 criada e enviada para ${contact.name}`);
            totalSent++;
          } else {
            // Marcar como falha
            await supabase
              .from('campaign_messages')
              .update({
                status: 'failed',
                error_message: 'Falha ao enviar',
              })
              .eq('id', newMessage.id);
          }
        }
      }

      // 🆕 FASE 4: M2 após resposta a follow-up
      const { data: m2AfterFollowup, error: m2FollowupError } = await supabase
        .from('contact_interaction_status')
        .select(`
          id,
          contact_id,
          campaign_id,
          message1_response_received_at,
          contacts!inner (
            id,
            name,
            phone,
            preferred_connection_id,
            whatsapp_connections!preferred_connection_id (
              id,
              name,
              api_token,
              instance_id,
              status
            )
          )
        `)
        .eq('campaign_id', campaign.id)
        .eq('current_stage', 'waiting_message2_after_followup')
        .lte('message1_response_received_at', cutoffTime)
        .limit(10);

      if (m2FollowupError) {
        console.error('❌ Erro ao buscar M2 pós-follow-up:', m2FollowupError);
      } else if (m2AfterFollowup && m2AfterFollowup.length > 0) {
        console.log(`📤 [Interactive] ${m2AfterFollowup.length} contatos aguardando M2 (pós-follow-up)`);
        
        for (const status of m2AfterFollowup) {
          const contact = status.contacts as any;
          const connection = contact.whatsapp_connections as any;

          if (!connection || connection.status !== 'connected') {
            console.log(`⚠️ [Interactive] Contato ${contact.name} sem conexão ativa`);
            continue;
          }

          // Selecionar variação aleatória da M2
          const m2Index = Math.floor(Math.random() * message2List.length);
          const m2 = message2List[m2Index];
          
          let messageText = m2.text
            .replace(/\{\{nome\}\}/g, contact.name)
            .replace(/\{\{telefone\}\}/g, contact.phone);

          // 1️⃣ CRIAR registro de M2 em campaign_messages
          const { data: newMessage, error: insertError } = await supabase
            .from('campaign_messages')
            .insert({
              campaign_id: campaign.id,
              contact_id: contact.id,
              empresa_id: campaign.empresa_id,
              message_text: messageText,
              part1_variation: null,
              part2_variation: m2Index + 1,
              media_url: m2.media_url || null,
              message_part: 2,
              status: 'pending',
            })
            .select()
            .single();

          if (insertError) {
            console.error(`❌ [Interactive] Erro ao criar M2 (pós-follow-up) para ${contact.name}:`, insertError);
            continue;
          }

          // 2️⃣ ENVIAR M2
          const sent = await sendMessage(
            uazapiBaseUrl,
            connection.instance_id,
            connection.api_token,
            contact.phone,
            messageText,
            m2.media_url,
            m2.media_type
          );

          if (sent) {
            // 3️⃣ ATUALIZAR campaign_messages como 'sent'
            await supabase
              .from('campaign_messages')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                used_connection_id: connection.id,
              })
              .eq('id', newMessage.id);

            // 4️⃣ ATUALIZAR interaction_status
            await supabase
              .from('contact_interaction_status')
              .update({
                current_stage: 'waiting_message2_response',
                message2_sent_at: new Date().toISOString(),
              })
              .eq('id', status.id);

            console.log(`✅ [Interactive] M2 criada e enviada (pós-follow-up) para ${contact.name}`);
            totalSent++;

            // 5️⃣ INCREMENTAR contador
            await supabase.rpc('increment_sent_messages', { campaign_id: campaign.id });
          } else {
            // Marcar como falha
            await supabase
              .from('campaign_messages')
              .update({
                status: 'failed',
                error_message: 'Falha ao enviar',
              })
              .eq('id', newMessage.id);
          }
        }
      }

      // FASE 3: Detectar Timeouts
      const timeoutHours = config.timeout_hours || 24;
      const timeoutCutoff = new Date(Date.now() - (timeoutHours * 60 * 60 * 1000)).toISOString();

      // Timeout M1
      const { data: timeoutM1, error: timeout1Error } = await supabase
        .from('contact_interaction_status')
        .select('id, contact_id, campaign_id')
        .eq('campaign_id', campaign.id)
        .eq('current_stage', 'waiting_message1_response')
        .lte('message1_sent_at', timeoutCutoff);

      if (timeoutM1 && timeoutM1.length > 0) {
        console.log(`⏱️ [Interactive] ${timeoutM1.length} timeouts de M1 detectados`);
        
        for (const status of timeoutM1) {
          // Iniciar follow-up (mas ainda pode receber M2 se responder)
          await initializeFollowUp(supabase, status.campaign_id, status.contact_id);
          
          await supabase
            .from('contact_interaction_status')
            .update({
              current_stage: 'waiting_message1_response_via_followup',
              followup_started: true,
              flow_completed: false, // Ainda não completou! Pode receber M2
            })
            .eq('id', status.id);
          
          console.log(`⏱️ [Interactive] Contato ${status.contact_id} timeout M1, iniciando follow-ups (M2 ainda pode ser enviada)`);
          totalTimeouts++;
        }
        
        // Verificar se campanha foi concluída após timeout M1
        await checkCampaignCompletion(supabase, campaign.id);
      }

      // Timeout M2
      const { data: timeoutM2, error: timeout2Error } = await supabase
        .from('contact_interaction_status')
        .select('id, contact_id, campaign_id')
        .eq('campaign_id', campaign.id)
        .eq('current_stage', 'waiting_message2_response')
        .lte('message2_sent_at', timeoutCutoff);

      if (timeoutM2 && timeoutM2.length > 0) {
        console.log(`⏱️ [Interactive] ${timeoutM2.length} timeouts de M2 detectados`);
        
        for (const status of timeoutM2) {
          // Timeout M2: iniciar follow-up e marcar como completo
          await initializeFollowUp(supabase, status.campaign_id, status.contact_id);
          
          await supabase
            .from('contact_interaction_status')
            .update({
              current_stage: 'completed',
              followup_started: true,
              flow_completed: true, // M2 já foi enviada, fluxo completo
            })
            .eq('id', status.id);
          
          console.log(`⏱️ [Interactive] Contato ${status.contact_id} timeout M2, iniciando follow-ups`);
          totalTimeouts++;
        }
        
        // Verificar se campanha foi concluída após timeout M2
        await checkCampaignCompletion(supabase, campaign.id);
      }

      totalProcessed++;
    }

    console.log(`\n✅ [Interactive] Processamento concluído:`);
    console.log(`   - Campanhas processadas: ${totalProcessed}`);
    console.log(`   - Mensagens enviadas: ${totalSent}`);
    console.log(`   - Follow-ups iniciados: ${totalTimeouts}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        campaigns_processed: totalProcessed,
        messages_sent: totalSent,
        followups_started: totalTimeouts
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [Interactive] Erro:', error);
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

async function sendMessage(
  baseUrl: string,
  instanceId: string,
  apiToken: string,
  phone: string,
  text: string,
  mediaUrl?: string,
  mediaType?: string
): Promise<boolean> {
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    
    let endpoint = `${baseUrl}/send/text`;
    let body: any = {
      number: cleanPhone,
      text: text,
    };

    // Se tem mídia, usar endpoint de mídia
    if (mediaUrl) {
      endpoint = `${baseUrl}/send/media`;
      
      // Determinar tipo baseado na extensão ou usar o fornecido
      let type = mediaType || 'image';
      const urlLower = String(mediaUrl).toLowerCase();
      if (urlLower.match(/\.(mp4|mov|m4v)$/)) type = 'video';
      else if (urlLower.match(/\.(mp3|ogg|wav)$/)) type = 'audio';
      else if (urlLower.match(/\.(pdf|doc|docx)$/)) type = 'document';

      body = {
        number: cleanPhone,
        type: type,
        file: mediaUrl,
        text: text,
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': apiToken,  // Token no header
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ Erro ao enviar mensagem: ${response.status} - ${errorData}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    return false;
  }
}

function isWithinAllowedTime(startTime: string, endTime: string, allowedDays: any): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];

  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  const currentTime = currentHour * 60 + currentMinute;
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;

  const days = typeof allowedDays === 'string' ? JSON.parse(allowedDays) : allowedDays;

  return currentTime >= start && currentTime <= end && days.includes(currentDay);
}

async function initializeFollowUp(supabase: any, campaignId: string, contactId: string) {
  try {
    const { data: flow, error: flowError } = await supabase
      .from('follow_up_flows')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .maybeSingle();

    if (flowError || !flow) {
      console.log(`⚠️ [Follow-up] Nenhum flow ativo para campanha ${campaignId}`);
      return;
    }

    const { data: firstMessage, error: messageError } = await supabase
      .from('follow_up_messages')
      .select('days_after_previous')
      .eq('flow_id', flow.id)
      .eq('step_number', 1)
      .maybeSingle();

    if (messageError || !firstMessage) {
      console.log(`⚠️ [Follow-up] Nenhuma mensagem configurada para flow ${flow.id}`);
      return;
    }

    const nextMessageDate = new Date();
    nextMessageDate.setDate(nextMessageDate.getDate() + firstMessage.days_after_previous);

    await supabase
      .from('contact_follow_up_status')
      .insert({
        flow_id: flow.id,
        contact_id: contactId,
        campaign_id: campaignId,
        current_step: 1,
        is_active: true,
        next_message_at: nextMessageDate.toISOString(),
      });

    console.log(`✅ [Follow-up] Iniciado para contato ${contactId}`);
  } catch (error) {
    console.error('❌ [Follow-up] Erro ao inicializar:', error);
  }
}
