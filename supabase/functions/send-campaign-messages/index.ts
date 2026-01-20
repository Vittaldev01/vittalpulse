import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===========================
// MEDIA ITEM INTERFACE
// ===========================

interface MediaItem {
  url: string;
  type: "image" | "video" | "audio" | "document";
  name?: string;
}

// ===========================
// HELPER FUNCTIONS PARA LOCK
// ===========================

async function cleanExpiredLocks(supabase: any) {
  const expiredTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutos
  await supabase
    .from('campaign_processing_lock')
    .delete()
    .lt('locked_at', expiredTime);
}

async function tryAcquireLock(supabase: any, campaignId: string): Promise<boolean> {
  const lockId = `send-${Date.now()}`;
  
  const { data, error } = await supabase
    .from('campaign_processing_lock')
    .insert({
      campaign_id: campaignId,
      locked_by: lockId,
      process_type: 'campaign',
      locked_at: new Date().toISOString(),
    })
    .select();

  if (error) {
    // Se já existe lock, retornar false
    if (error.code === '23505') {
      console.log(`⏳ Campanha ${campaignId} já está sendo processada por outra invocação`);
      return false;
    }
    throw error;
  }

  console.log(`🔒 Lock adquirido para campanha ${campaignId} (${lockId})`);
  return true;
}

async function releaseLock(supabase: any, campaignId: string) {
  await supabase
    .from('campaign_processing_lock')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('process_type', 'campaign');
  
  console.log(`🔓 Lock liberado para campanha ${campaignId}`);
}

// ===========================
// CLEAN STUCK MESSAGES
// ===========================

async function cleanStuckMessages(supabase: any) {
  // Mensagens em processing há mais de 5 minutos são consideradas órfãs
  const stuckTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data: stuckMessages } = await supabase
    .from('campaign_messages')
    .update({ 
      status: 'pending',
      processing_started_at: null 
    })
    .eq('status', 'processing')
    .lt('processing_started_at', stuckTime)
    .select('id');
  
  if (stuckMessages && stuckMessages.length > 0) {
    console.log(`🔄 Resetadas ${stuckMessages.length} mensagens travadas em processing`);
  }
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

    console.log('🚀 Iniciando processamento de mensagens...');

    // Limpar locks expirados
    await cleanExpiredLocks(supabase);

    // Limpar mensagens órfãs em processing
    await cleanStuckMessages(supabase);

    // Buscar campanhas ativas
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_connections(
          whatsapp_connections(id, instance_id, api_token, name, status)
        ),
        whatsapp_connections(id, instance_id, api_token, name, status)
      `)
      .in('status', ['running'])
      .or('next_batch_at.is.null,next_batch_at.lt.' + new Date().toISOString())
      .order('created_at', { ascending: true });

    if (campaignsError) throw campaignsError;

    console.log(`📋 Encontradas ${campaigns?.length || 0} campanhas ativas`);

    for (const campaign of campaigns || []) {
      try {
        await processCampaign(supabase, campaign);
      } catch (error) {
        console.error(`❌ Erro ao processar campanha ${campaign.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Processamento concluído' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro geral:', error);
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
// PROCESS CAMPAIGN
// ===========================

async function processCampaign(supabase: any, campaign: any) {
  console.log(`\n📋 Processando campanha: ${campaign.name} (${campaign.id})`);

  // Verificar se está em pausa (aguardando próximo batch)
  if (campaign.next_batch_at) {
    const nextBatch = new Date(campaign.next_batch_at);
    const now = new Date();
    if (now < nextBatch) {
      console.log(`⏳ Campanha em pausa até ${nextBatch.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
      return;
    }
  }

  // Tentar adquirir lock
  const hasLock = await tryAcquireLock(supabase, campaign.id);
  if (!hasLock) {
    console.log(`⏭️ Pulando campanha ${campaign.id} (já está sendo processada)`);
    return;
  }

  try {
    // Obter conexões disponíveis
    let availableConnections: any[] = [];
    
    if (campaign.campaign_connections && campaign.campaign_connections.length > 0) {
      availableConnections = campaign.campaign_connections.map((cc: any) => cc.whatsapp_connections);
      console.log(`📋 Campanha com ${availableConnections.length} conexões`);
    } else if (campaign.whatsapp_connections) {
      availableConnections = [campaign.whatsapp_connections];
      console.log('📋 Usando conexão legada única');
    } else {
      console.log('❌ Nenhuma conexão configurada');
      return;
    }

    const activeConnections = availableConnections.filter(c => c.status === 'connected');
    
    if (activeConnections.length === 0) {
      console.log('❌ Nenhuma conexão ativa. Pausando campanha.');
      await supabase
        .from('campaigns')
        .update({ 
          status: 'paused',
          updated_at: new Date().toISOString()
        })
        .eq('id', campaign.id);
      return;
    }

    console.log(`✅ ${activeConnections.length} conexão(ões) ativa(s)`);

    // Configurações de delay
    const minSeconds = campaign.min_interval_seconds || 30;
    const maxSeconds = campaign.max_interval_seconds || 60;
    const pauseAfter = campaign.pause_after_messages || 20;
    const pauseDuration = campaign.pause_duration_minutes || 10;

    console.log(`⚙️ Config: ${minSeconds}-${maxSeconds}s por msg, pausa após ${pauseAfter} msgs por ${pauseDuration}min`);

    // Processar batch de mensagens
    let messagesSent = 0;
    
    while (true) {
      // Verificar se atingiu limite de pausa
      if (messagesSent >= pauseAfter) {
        const nextBatchTime = new Date(Date.now() + pauseDuration * 60 * 1000);
        
        await supabase
          .from('campaigns')
          .update({ next_batch_at: nextBatchTime.toISOString() })
          .eq('id', campaign.id);
        
        console.log(`⏸️ Batch de ${pauseAfter} mensagens completo. Próximo batch às ${nextBatchTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
        break; // Sair do loop, próxima invocação continuará
      }

      // Verificar horário/dia permitido
      if (!isWithinAllowedTime(campaign.allowed_hours_start, campaign.allowed_hours_end, campaign.allowed_days)) {
        console.log('⏰ Fora do horário permitido');
        break;
      }

      // Buscar próxima mensagem pendente
      const { data: messages } = await supabase
        .from('campaign_messages')
        .select('*, contacts(name, phone)')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .order('contact_id', { ascending: true })
        .order('message_part', { ascending: true })
        .limit(1);

      if (!messages || messages.length === 0) {
        console.log('✅ Não há mais mensagens pendentes');
        
        // Verificar se campanha está completa
        const { data: allMessages } = await supabase
          .from('campaign_messages')
          .select('status')
          .eq('campaign_id', campaign.id);
        
        const allSent = allMessages?.every((m: any) => m.status === 'sent' || m.status === 'failed');
        
        if (allSent && campaign.campaign_type !== 'interactive') {
          await supabase
            .from('campaigns')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString(),
              next_batch_at: null
            })
            .eq('id', campaign.id);
          console.log('🎉 Campanha concluída');
        }
        
        break;
      }

      const message = messages[0];

      // Para part2, verificar se part1 foi enviada
      if (message.message_part === 2) {
        const { data: part1 } = await supabase
          .from('campaign_messages')
          .select('sent_at, status')
          .eq('campaign_id', campaign.id)
          .eq('contact_id', message.contact_id)
          .eq('message_part', 1)
          .limit(1);

        if (!part1 || part1.length === 0 || part1[0].status !== 'sent') {
          console.log('⏭️ Part1 ainda não foi enviada. Pulando part2.');
          break;
        }

        // Verificar delay de 3s entre partes
        const part1SentAt = new Date(part1[0].sent_at);
        const diffSeconds = (Date.now() - part1SentAt.getTime()) / 1000;
        
        if (diffSeconds < 3) {
          console.log(`⏳ Aguardando delay de 3s entre partes (${diffSeconds.toFixed(1)}s decorridos)`);
          await new Promise(resolve => setTimeout(resolve, (3 - diffSeconds) * 1000));
        }
      }

      // Tentar enviar mensagem
      const sent = await sendMessage(supabase, campaign, message, activeConnections);
      
      if (sent) {
        messagesSent++;
        
        // Se enviou M1, aguardar apenas 3 segundos antes de M2
        if (message.message_part === 1) {
          console.log(`⏱️ M1 enviada. Aguardando 3s para enviar M2 ao mesmo lead...`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3 segundos fixo
        } else {
          // Após M2 ou mensagem única, aplicar delay aleatório antes do próximo lead
          const randomDelay = Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
          console.log(`⏱️ Aguardando ${randomDelay}s até próximo lead...`);
          await new Promise(resolve => setTimeout(resolve, randomDelay * 1000));
        }
      } else {
        console.log('❌ Falha ao enviar mensagem. Continuando...');
      }
    }

  } finally {
    // Sempre liberar lock no final
    await releaseLock(supabase, campaign.id);
  }
}

// ===========================
// CHECK CONNECTION REAL STATUS
// ===========================

async function checkConnectionRealStatus(supabase: any, connection: any): Promise<boolean> {
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
    const isConnected = data.status?.connected === true && data.status?.loggedIn === true;
    
    // Atualizar banco se status divergente
    if (!isConnected && connection.status === 'connected') {
      console.log(`⚠️ Chip ${connection.name} está desconectado! Atualizando banco...`);
      await supabase
        .from('whatsapp_connections')
        .update({ status: 'disconnected' })
        .eq('id', connection.id);
    }
    
    return isConnected;
  } catch (error) {
    console.error(`❌ Erro ao verificar status do chip:`, error);
    return false;
  }
}

// ===========================
// GET CONTACT PHONES (ordenados por prioridade)
// ===========================

async function getContactPhones(supabase: any, contactId: string): Promise<any[]> {
  // Buscar telefones da tabela contact_phones
  const { data: phones } = await supabase
    .from('contact_phones')
    .select('*')
    .eq('contact_id', contactId)
    .order('is_primary', { ascending: false })
    .order('phone_type', { ascending: true }); // whatsapp primeiro

  if (phones && phones.length > 0) {
    // Priorizar: 1. WhatsApp validado, 2. Primary, 3. Unknown, 4. Landline
    return phones.sort((a: any, b: any) => {
      // WhatsApp validado tem prioridade máxima
      if (a.phone_type === 'whatsapp' && b.phone_type !== 'whatsapp') return -1;
      if (b.phone_type === 'whatsapp' && a.phone_type !== 'whatsapp') return 1;
      // Depois primary
      if (a.is_primary && !b.is_primary) return -1;
      if (b.is_primary && !a.is_primary) return 1;
      // Depois unknown (ainda não validado)
      if (a.phone_type === 'unknown' && b.phone_type !== 'unknown') return -1;
      if (b.phone_type === 'unknown' && a.phone_type !== 'unknown') return 1;
      return 0;
    });
  }

  // Fallback: buscar telefone principal do contato
  const { data: contact } = await supabase
    .from('contacts')
    .select('phone')
    .eq('id', contactId)
    .single();

  if (contact?.phone) {
    return [{
      id: null,
      phone: contact.phone,
      phone_type: 'unknown',
      is_primary: true,
      is_whatsapp: null
    }];
  }

  return [];
}

// ===========================
// SEND MESSAGE WITH PHONE FALLBACK
// ===========================

async function sendMessage(supabase: any, campaign: any, message: any, activeConnections: any[]): Promise<boolean> {
  try {
    // Lock otimista com timestamp para detectar mensagens órfãs
    const { data: lockResult } = await supabase
      .from('campaign_messages')
      .update({ 
        status: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', message.id)
      .eq('status', 'pending')
      .select('id');

    if (!lockResult || lockResult.length === 0) {
      console.log(`⏭️ Mensagem ${message.id} já processada`);
      return false;
    }

    // Buscar todos os telefones do contato
    const phones = await getContactPhones(supabase, message.contact_id);
    
    if (phones.length === 0) {
      console.log(`❌ Contato ${message.contact_id} sem telefones`);
      await supabase
        .from('campaign_messages')
        .update({
          status: 'failed',
          error_message: 'Contato sem telefone válido',
        })
        .eq('id', message.id);
      return false;
    }

    console.log(`📱 Contato tem ${phones.length} telefone(s) disponível(is)`);

    // Buscar contato com conexão preferencial
    const { data: contact } = await supabase
      .from('contacts')
      .select(`
        id,
        phone,
        name,
        preferred_connection_id,
        preferred_connection:whatsapp_connections!preferred_connection_id(
          id, name, status, instance_id, api_token
        )
      `)
      .eq('id', message.contact_id)
      .single();

    let selectedConnection;

    // Selecionar conexão
    if (contact?.preferred_connection_id && contact.preferred_connection?.status === 'connected') {
      const isReallyConnected = await checkConnectionRealStatus(supabase, contact.preferred_connection);
      
      if (!isReallyConnected) {
        console.log(`❌ Chip preferencial ${contact.preferred_connection.name} está desconectado! Pausando campanha.`);
        
        await supabase
          .from('campaigns')
          .update({ 
            status: 'paused',
            pause_reason: 'chip_disconnected'
          })
          .eq('id', campaign.id);
        
        await supabase
          .from('campaign_messages')
          .update({ status: 'pending' })
          .eq('id', message.id);
        
        return false;
      }
      
      selectedConnection = contact.preferred_connection;
      console.log(`📌 Usando chip preferencial: ${selectedConnection.name}`);
    } else if (contact?.preferred_connection_id && contact.preferred_connection?.status !== 'connected') {
      selectedConnection = selectRandomConnection(activeConnections);
      await supabase
        .from('contacts')
        .update({ preferred_connection_id: selectedConnection.id })
        .eq('id', contact.id);
      console.log(`🔄 Novo chip definido: ${selectedConnection.name}`);
    } else {
      if (message.message_part === 2) {
        const { data: part1Message } = await supabase
          .from('campaign_messages')
          .select('used_connection_id, whatsapp_connections!inner(id, name, status, instance_id, api_token)')
          .eq('campaign_id', campaign.id)
          .eq('contact_id', message.contact_id)
          .eq('message_part', 1)
          .eq('status', 'sent')
          .maybeSingle();

        if (part1Message?.whatsapp_connections?.status === 'connected') {
          selectedConnection = part1Message.whatsapp_connections;
          console.log(`🔗 Mesma conexão da part1: ${selectedConnection.name}`);
        } else {
          selectedConnection = selectRandomConnection(activeConnections);
          console.log(`⚠️ Fallback para part2: ${selectedConnection.name}`);
        }
      } else {
        selectedConnection = selectRandomConnection(activeConnections);
        await supabase
          .from('contacts')
          .update({ preferred_connection_id: selectedConnection.id })
          .eq('id', contact.id);
        console.log(`🎯 Novo contato - chip definido: ${selectedConnection.name}`);
      }
    }

    // Tentar enviar para cada telefone até ter sucesso
    const uazapiUrl = Deno.env.get('UAZAPI_BASE_URL')!;
    const globalToken = Deno.env.get('UAZAPI_TOKEN')!;
    const apiToken = selectedConnection.api_token || globalToken;

    let lastError = '';
    let successfulPhone: any = null;
    let attemptNumber = 0;

    // Filtrar telefones válidos (excluir inválidos e fixos se não quiser)
    const validPhones = phones.filter((p: any) => 
      p.phone_type !== 'invalid' && p.phone_type !== 'landline'
    );

    // Se não há telefones válidos, tentar todos (unknown pode funcionar)
    const phonesToTry = validPhones.length > 0 ? validPhones : phones.filter((p: any) => p.phone_type !== 'invalid');

    for (const phoneRecord of phonesToTry) {
      attemptNumber++;
      const cleanPhone = phoneRecord.phone.replace(/\D/g, '');
      
      // Adicionar código do país se necessário
      const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      
      console.log(`📤 Tentativa ${attemptNumber}/${phonesToTry.length}: Enviando para ${formattedPhone} (${phoneRecord.phone_type})`);

      // Check if message has multiple media items
      const mediaItems: MediaItem[] = message.media_items || [];
      const hasMultipleMedia = mediaItems.length > 0;

      try {
        let sendSuccess = false;

        if (hasMultipleMedia) {
          // NEW: Send multiple media items
          // First media: WITH message text
          const firstMedia = mediaItems[0];
          const firstSuccess = await sendSingleMedia(uazapiUrl, apiToken, formattedPhone, firstMedia, message.message_text);
          
          if (!firstSuccess) {
            throw new Error('Falha ao enviar primeira mídia');
          }

          // Remaining media: WITHOUT text, with 1.5s delay between each
          for (let i = 1; i < mediaItems.length; i++) {
            console.log(`⏱️ Aguardando 1.5s antes de enviar mídia ${i + 1}/${mediaItems.length}...`);
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const success = await sendSingleMedia(uazapiUrl, apiToken, formattedPhone, mediaItems[i], null);
            if (!success) {
              console.error(`⚠️ Falha ao enviar mídia ${i + 1}, continuando com as demais...`);
            }
          }
          
          sendSuccess = true;
        } else if (message.media_url) {
          // LEGACY: Single media format
          let mediaType = 'image';
          const urlLower = String(message.media_url).toLowerCase();
          if (urlLower.match(/\.(mp4|mov|m4v)$/)) mediaType = 'video';
          else if (urlLower.match(/\.(mp3|ogg|wav|m4a)$/)) mediaType = 'audio';
          else if (urlLower.match(/\.(pdf|doc|docx)$/)) mediaType = 'document';

          const endpoint = `${uazapiUrl}/send/media`;
          const body = {
            number: formattedPhone,
            type: mediaType,
            file: message.media_url,
            text: message.message_text,
          };

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'token': apiToken,
            },
            body: JSON.stringify(body),
          });

          if (response.ok) {
            sendSuccess = true;
          } else {
            const responseData = await response.text();
            throw new Error(responseData);
          }
        } else {
          // TEXT ONLY
          const endpoint = `${uazapiUrl}/send/text`;
          const body = {
            number: formattedPhone,
            text: message.message_text,
          };

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'token': apiToken,
            },
            body: JSON.stringify(body),
          });

          if (response.ok) {
            sendSuccess = true;
          } else {
            const responseData = await response.text();
            throw new Error(responseData);
          }
        }

        if (sendSuccess) {
          // Success!
          successfulPhone = phoneRecord;
          
          // Update phone as validated WhatsApp
          if (phoneRecord.id && phoneRecord.phone_type !== 'whatsapp') {
            await supabase
              .from('contact_phones')
              .update({
                phone_type: 'whatsapp',
                is_whatsapp: true,
                validated_at: new Date().toISOString(),
                validation_error: null,
              })
              .eq('id', phoneRecord.id);
            console.log(`✅ Telefone ${formattedPhone} confirmado como WhatsApp`);
          }

          break; // Exit loop, message sent successfully
        }
      } catch (err: any) {
        console.log(`❌ Falha no telefone ${formattedPhone}: ${err.message}`);
        lastError = err.message || String(err);

        // Mark phone as invalid if error indicates so
        const errorStr = String(lastError).toLowerCase();
        if (errorStr.includes('not registered') || 
            errorStr.includes('invalid number') ||
            errorStr.includes('not found') ||
            errorStr.includes('not a valid')) {
          
          if (phoneRecord.id) {
            await supabase
              .from('contact_phones')
              .update({
                phone_type: 'invalid',
                is_whatsapp: false,
                validated_at: new Date().toISOString(),
                validation_error: lastError,
              })
              .eq('id', phoneRecord.id);
            console.log(`🚫 Telefone ${formattedPhone} marcado como inválido`);
          }
        }

        // Wait a bit before trying next
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!successfulPhone) {
      // Nenhum telefone funcionou
      console.log(`❌ Falha em todos os ${phonesToTry.length} telefones`);
      await supabase
        .from('campaign_messages')
        .update({
          status: 'failed',
          error_message: `Falha em ${phonesToTry.length} telefone(s): ${lastError}`,
          phone_attempt: attemptNumber,
        })
        .eq('id', message.id);
      return false;
    }

    // Atualizar mensagem como enviada
    const sentAt = new Date().toISOString();
    await supabase
      .from('campaign_messages')
      .update({
        status: 'sent',
        sent_at: sentAt,
        used_connection_id: selectedConnection.id,
        phone_used: successfulPhone.phone,
        phone_attempt: attemptNumber,
        contact_phone_id: successfulPhone.id || null,
      })
      .eq('id', message.id);

    // Para campanhas interativas, atualizar interaction_status
    if (campaign.campaign_type === 'interactive' && message.message_part === 1) {
      await supabase
        .from('contact_interaction_status')
        .update({
          current_stage: 'waiting_message1_response',
          message1_sent_at: sentAt,
        })
        .eq('campaign_id', campaign.id)
        .eq('contact_id', message.contact_id);
    }

    // Incrementar contador
    await supabase.rpc('increment_sent_messages', { campaign_id: campaign.id });

    console.log(`✅ Part${message.message_part} enviada com sucesso para ${successfulPhone.phone} (tentativa ${attemptNumber})`);
    return true;

  } catch (error) {
    console.error('❌ Erro ao enviar:', error);
    
    await supabase
      .from('campaign_messages')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido',
      })
      .eq('id', message.id);
    
    return false;
  }
}

// ===========================
// HELPERS
// ===========================

async function sendSingleMedia(
  uazapiUrl: string, 
  apiToken: string, 
  phone: string, 
  mediaItem: MediaItem, 
  text: string | null
): Promise<boolean> {
  try {
    const endpoint = `${uazapiUrl}/send/media`;
    
    const body = {
      number: phone,
      type: mediaItem.type,
      file: mediaItem.url,
      text: text || '',
    };

    console.log(`📎 Enviando mídia: tipo=${mediaItem.type}, url=${mediaItem.url.substring(0, 60)}...${text ? ' [COM TEXTO]' : ' [SEM TEXTO]'}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': apiToken },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ Erro ao enviar mídia: ${errorData}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar mídia:', error);
    return false;
  }
}

function selectRandomConnection(connections: any[]) {
  const activeConnections = connections.filter(c => c.status === 'connected');
  if (activeConnections.length === 0) throw new Error('Nenhuma conexão ativa');
  const randomIndex = Math.floor(Math.random() * activeConnections.length);
  return activeConnections[randomIndex];
}

function isWithinAllowedTime(startTime: string, endTime: string, allowedDays: any): boolean {
  const now = new Date();
  const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const currentHour = brasiliaTime.toTimeString().slice(0, 8);
  const currentDay = brasiliaTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  // Validar horário
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

  // Validar dia
  const parseAllowedDays = (value: any): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.startsWith('[')) {
        try { return JSON.parse(trimmed); } catch { return []; }
      }
      return trimmed.split(',').map(d => d.trim()).filter(Boolean);
    }
    return [];
  };

  const allowedDaysList = parseAllowedDays(allowedDays);
  if (allowedDaysList.length > 0 && !allowedDaysList.includes(currentDay)) {
    return false;
  }

  return true;
}
