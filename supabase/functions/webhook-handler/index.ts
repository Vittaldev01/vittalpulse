import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max 100 requests per minute per connection

function checkRateLimit(connectionId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(connectionId);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(connectionId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let webhookLogId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log('📥 Webhook recebido:', JSON.stringify(payload, null, 2));

    // UAZAPI envia token único para identificar a conexão
    const webhookToken = payload.token;
    
    // Normalizar EventType de diferentes formatos possíveis
    const event = payload.EventType || payload.event || payload.type || 'unknown';
    console.log('📋 Evento normalizado:', event);

    if (!webhookToken) {
      console.error('❌ Payload sem token:', payload);
      throw new Error('token não fornecido no payload');
    }

    // Buscar conexão pelo api_token
    console.log('🔍 Buscando conexão para token:', webhookToken.substring(0, 10) + '...');
    const { data: connection, error: connectionError } = await supabase
      .from('whatsapp_connections')
      .select('id, instance_id, name')
      .eq('api_token', webhookToken)
      .single();

    if (connectionError) {
      console.error('❌ Conexão não encontrada para token:', webhookToken);
      throw new Error('Conexão não encontrada');
    }

    console.log(`✅ Conexão encontrada: ${connection.name} (${connection.id})`);

    // Check rate limit
    if (!checkRateLimit(connection.id)) {
      console.warn(`⚠️ Rate limit exceeded for connection: ${connection.id}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Registrar no log de webhooks e capturar o ID
    const { data: webhookLog, error: logError } = await supabase
      .from('webhooks_log')
      .insert({
        connection_id: connection.id,
        event_type: event,
        payload: payload,
        processed: false,
      })
      .select('id')
      .single();

    if (logError) {
      console.error('❌ Erro ao registrar webhook_log:', logError);
    } else {
      webhookLogId = webhookLog.id;
      console.log(`📝 Webhook registrado com ID: ${webhookLogId}`);
    }

    // Processar evento de mensagem recebida
    // Normalizar fromMe de diferentes formatos possíveis
    const fromMe = payload.message?.fromMe ?? payload.message?.from_me ?? false;
    console.log('👤 fromMe normalizado:', fromMe);

    if (event === 'messages' && fromMe === false) {
      console.log('💬 Processando mensagem recebida do contato...');
      
      // Tentar múltiplas formas de extrair o telefone
      let phone = '';
      
      // Formato 1: chat.phone (ex: +55 77 8120-7230)
      if (payload.chat?.phone) {
        phone = payload.chat.phone.replace(/\D/g, '');
        console.log('📱 Telefone extraído de chat.phone:', phone);
      }
      
      // Formato 2: message.sender (ex: 557781370335@s.whatsapp.net)
      if (!phone && payload.message?.sender) {
        phone = payload.message.sender.split('@')[0].replace(/\D/g, '');
        console.log('📱 Telefone extraído de message.sender:', phone);
      }
      
      // Formato 3: chat.wa_chatid
      if (!phone && payload.chat?.wa_chatid) {
        phone = payload.chat.wa_chatid.split('@')[0].replace(/\D/g, '');
        console.log('📱 Telefone extraído de chat.wa_chatid:', phone);
      }

      // Formato 4: message.from.id (fallback adicional)
      if (!phone && payload.message?.from?.id) {
        phone = payload.message.from.id.split('@')[0].replace(/\D/g, '');
        console.log('📱 Telefone extraído de message.from.id:', phone);
      }
      
      const messageText = payload.message?.text || payload.message?.content || '';
      console.log('💭 Texto da mensagem:', messageText);

      if (!phone) {
        console.error('❌ Não foi possível extrair telefone do payload');
        console.log('🔍 Payload completo:', JSON.stringify(payload));
      } else {
        // Buscar contato pelo telefone (com busca flexível)
        console.log('🔎 Buscando contato com telefone:', phone);
        
        // Gerar variantes com e sem o nono dígito após DDD (Brasil)
        const variants = new Set<string>();
        variants.add(phone);
        if (phone.startsWith('55')) {
          // Ex.: 55 + DDD (2) + número (8) = 12 dígitos (sem o 9) → adicionar '9'
          if (phone.length === 12) {
            variants.add(phone.slice(0, 4) + '9' + phone.slice(4));
          }
          // Ex.: 55 + DDD (2) + 9 + número (8) = 13 dígitos (com o 9) → remover '9'
          if (phone.length === 13 && phone[4] === '9') {
            variants.add(phone.slice(0, 4) + phone.slice(5));
          }
        }

        // Sufixos para busca flexível (últimos 11..8 dígitos)
        const suffixes = [11, 10, 9, 8].map((n) => phone.slice(-n));
        console.log('🔄 Variantes geradas:', Array.from(variants));
        console.log('🔄 Sufixos para busca:', suffixes);
        
        // Montar filtro OR dinâmico
        const orFilters: string[] = [];
        for (const v of variants) {
          orFilters.push(`phone.eq.${v}`);
        }
        for (const s of suffixes) {
          orFilters.push(`phone.like.%${s}`);
        }

        // Buscar TODOS os contatos com aquele telefone
        const { data: contacts, error: contactError } = await supabase
          .from('contacts')
          .select('id, name, phone, list_id')
          .or(orFilters.join(','));

        if (contactError) {
          console.error('❌ Erro ao buscar contato:', contactError);
        }

        console.log(`📊 Encontrados ${contacts?.length || 0} contatos com telefone ${phone}`);

        if (contacts && contacts.length > 0) {
          const contact = contacts[0];
          const contactIds = contacts.map(c => c.id);
          console.log(`🎯 IDs dos contatos: ${contactIds.join(', ')}`);
          console.log(`👤 Registrando resposta para: ${contact.name} (${contact.phone})`);

          // Buscar última campanha que enviou mensagem para este contato
          const { data: lastMessage, error: messageError } = await supabase
            .from('campaign_messages')
            .select('campaign_id')
            .in('contact_id', contactIds)
            .eq('status', 'sent')
            .order('sent_at', { ascending: false })
            .limit(1)
            .single();

          if (messageError) {
            console.log('⚠️ Não foi possível encontrar campanha associada:', messageError);
          }

          const campaignId = lastMessage?.campaign_id || null;
          console.log(`📧 Campaign ID identificado: ${campaignId || 'nenhum'}`);

          // Registrar resposta COM campaign_id
          const { error: insertError } = await supabase
            .from('contact_responses')
            .insert({
              contact_id: contact.id,
              campaign_id: campaignId,
              phone: contact.phone,
              message_text: messageText,
              received_at: new Date().toISOString(),
              webhook_data: payload,
            });

          if (insertError) {
            console.error('❌ Erro ao inserir resposta:', insertError);
          } else {
            console.log(`✅ Resposta registrada para contato ${contact.name} (${contact.id})`);
          }

          // 🆕 PROCESSAR CAMPANHAS INTERATIVAS
          // Verificar se alguma mensagem veio de campanha interativa
          if (campaignId) {
            const { data: campaign, error: campaignError } = await supabase
              .from('campaigns')
              .select('id, campaign_type')
              .eq('id', campaignId)
              .maybeSingle();

            if (!campaignError && campaign && campaign.campaign_type === 'interactive') {
              console.log('💬 [Interactive] Detectada resposta de campanha interativa');

              // Buscar status de interação para TODOS os contatos
              const { data: interactionStatuses, error: statusError } = await supabase
                .from('contact_interaction_status')
                .select('id, current_stage, contact_id')
                .in('contact_id', contactIds)
                .eq('campaign_id', campaignId);

              if (statusError) {
                console.error('❌ [Interactive] Erro ao buscar interaction status:', statusError);
              } else if (interactionStatuses && interactionStatuses.length > 0) {
                for (const status of interactionStatuses) {
                  if (status.current_stage === 'waiting_message1_response') {
                    // Resposta à M1 direta → agendar M2
                    console.log(`✅ [Interactive] Contato ${status.contact_id} respondeu M1, agendando M2`);
                    await supabase
                      .from('contact_interaction_status')
                      .update({
                        current_stage: 'waiting_message2',
                        message1_response_received_at: new Date().toISOString(),
                      })
                      .eq('id', status.id);
                  }
                  // 🆕 FASE 3: Resposta a follow-up (após timeout M1)
                  else if (status.current_stage === 'waiting_message1_response_via_followup') {
                    console.log(`✅ [Interactive] Contato ${status.contact_id} respondeu follow-up, agendando M2`);
                    await supabase
                      .from('contact_interaction_status')
                      .update({
                        current_stage: 'waiting_message2_after_followup',
                        message1_response_received_at: new Date().toISOString(),
                      })
                      .eq('id', status.id);
                    
                    // Follow-ups continuam ativos! Só param quando responder M2
                  }
                  else if (status.current_stage === 'waiting_message2_response') {
                    // Resposta à M2 → marcar como completo
                    console.log(`✅ [Interactive] Contato ${status.contact_id} respondeu M2, fluxo completo`);
                    await supabase
                      .from('contact_interaction_status')
                      .update({
                        current_stage: 'completed',
                        message2_response_received_at: new Date().toISOString(),
                        flow_completed: true,
                      })
                      .eq('id', status.id);
                    
                    // 🆕 FASE 5: Pausar follow-ups após resposta M2
                    const { error: pauseError } = await supabase
                      .from('contact_follow_up_status')
                      .update({
                        is_active: false,
                        stopped_reason: 'user_replied_m2',
                        stopped_at: new Date().toISOString(),
                      })
                      .eq('campaign_id', campaignId)
                      .eq('contact_id', status.contact_id)
                      .eq('is_active', true);

                    if (pauseError) {
                      console.error('❌ Erro ao pausar follow-ups após M2:', pauseError);
                    } else {
                      console.log(`⏸️ Follow-ups pausados para contato ${status.contact_id}`);
                    }
                    
                    // Verificar se campanha foi concluída após resposta M2
                    await checkCampaignCompletion(supabase, campaign.id);
                  }
                }
              }
            }

            // 🔄 PAUSAR FOLLOW-UPS BASEADO NO TIPO DE CAMPANHA
            // Para campanhas SIMPLES: pausar em qualquer resposta
            // Para campanhas INTERATIVAS: pausar SOMENTE após resposta à M2
            if (!campaignError && campaign) {
              if (campaign.campaign_type === 'simple') {
                // Campanha simples: pausar follow-ups em qualquer resposta
      console.log(`🔄 [Simple] Pausando follow-ups para ${contactIds.length} contato(s)`);
      const { error: updateError } = await supabase
        .from('contact_follow_up_status')
        .update({
          is_active: false,
          stopped_at: new Date().toISOString(),
          stopped_reason: 'user_replied',
        })
        .in('contact_id', contactIds)
        .eq('campaign_id', campaignId)
        .eq('is_active', true);

                if (updateError) {
                  console.error('❌ Erro ao desativar follow-ups:', updateError);
                } else {
                  console.log(`✅ Follow-ups pausados para ${contactIds.length} contato(s)`);
                }
    } else if (campaign.campaign_type === 'interactive') {
      // Campanha interativa: pausar SOMENTE após resposta à M2
      // Como já processamos a resposta acima, precisamos buscar o estágio ATUALIZADO
      const { data: updatedStatuses } = await supabase
        .from('contact_interaction_status')
        .select('id, current_stage, contact_id')
        .in('contact_id', contactIds)
        .eq('campaign_id', campaignId);

      // Pausar follow-ups se algum contato completou o fluxo (respondeu M2)
      const shouldPauseFollowups = updatedStatuses?.some(
        s => s.current_stage === 'completed'
      );

      if (shouldPauseFollowups) {
        console.log(`🔄 [Interactive] Pausando follow-ups após M2 para ${contactIds.length} contato(s)`);
        const { error: updateError } = await supabase
          .from('contact_follow_up_status')
          .update({
            is_active: false,
            stopped_at: new Date().toISOString(),
            stopped_reason: 'user_replied_m2',
          })
          .in('contact_id', contactIds)
          .eq('campaign_id', campaignId)
          .eq('is_active', true);

        if (updateError) {
          console.error('❌ Erro ao desativar follow-ups:', updateError);
        } else {
          console.log(`✅ Follow-ups pausados após M2 para ${contactIds.length} contato(s)`);
        }
      } else {
        console.log(`ℹ️ [Interactive] Não pausar follow-ups - resposta foi para M1`);
      }
    }
            } else {
              // Fallback: se não conseguiu identificar o tipo, pausar por segurança
              console.log(`🔄 [Fallback] Pausando follow-ups para ${contactIds.length} contato(s) (tipo desconhecido)`);
    const { error: updateError } = await supabase
      .from('contact_follow_up_status')
      .update({
        is_active: false,
        stopped_at: new Date().toISOString(),
        stopped_reason: 'user_replied',
      })
      .in('contact_id', contactIds)
      .eq('campaign_id', campaignId)
      .eq('is_active', true);

              if (updateError) {
                console.error('❌ Erro ao desativar follow-ups:', updateError);
              } else {
                console.log(`✅ Follow-ups pausados para ${contactIds.length} contato(s)`);
              }
            }
          }
        } else {
          console.log('⚠️ Nenhum contato encontrado com telefone:', phone);
        }
      }
    } else {
      console.log(`ℹ️ Evento ignorado: ${event} (fromMe: ${fromMe})`);
    }

    // Marcar webhook como processado usando o ID capturado
    if (webhookLogId) {
      const { error: updateError } = await supabase
        .from('webhooks_log')
        .update({ processed: true })
        .eq('id', webhookLogId);

      if (updateError) {
        console.error('❌ Erro ao marcar webhook como processado:', updateError);
      } else {
        console.log(`✅ Webhook ${webhookLogId} marcado como processado`);
      }
    }

    console.log('🎉 Webhook processado com sucesso');
    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Tentar marcar como processado mesmo em caso de erro
    if (webhookLogId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from('webhooks_log')
        .update({ processed: true })
        .eq('id', webhookLogId);
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
