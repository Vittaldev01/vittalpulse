import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ContactData {
  name: string;
  phones: string[];
  customData: { [key: string]: string };
}

interface ImportRequest {
  listId: string;
  contacts: ContactData[];
  customFieldColumns: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    Deno.env.set('SUPABASE_URL', 'https://psizqlhatnopgmwhjykd.supabase.co')
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzaXpxbGhhdG5vcGdtd2hqeWtkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU3NTU4MiwiZXhwIjoyMDg0MTUxNTgyfQ.5PSNoFrkgw7EHBkyJBZGvt6X7rtiMT4PiYxSttd7Pkk')
    Deno.env.set('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzaXpxbGhhdG5vcGdtd2hqeWtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1NzU1ODIsImV4cCI6MjA4NDE1MTU4Mn0.hgASMYD4RbkRQJHb4EVmTFBmTkw9-C1EazA3PYzGZJU' )

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verificar autenticação do usuário
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cliente com service role para operações em lote
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { listId, contacts, customFieldColumns }: ImportRequest = await req.json();

    if (!listId || !contacts || !Array.isArray(contacts)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: listId, contacts' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting batch import: ${contacts.length} contacts for list ${listId}`);

    // 1. Criar campos customizados (se necessário)
    const customFieldIds: { [key: string]: string } = {};
    
    if (customFieldColumns.length > 0) {
      // Buscar campos existentes
      const { data: existingFields } = await supabase
        .from('custom_fields')
        .select('id, field_name')
        .eq('list_id', listId)
        .in('field_name', customFieldColumns.map(c => c.toLowerCase()));

      for (const field of existingFields || []) {
        customFieldIds[field.field_name] = field.id;
      }

      // Criar campos que não existem
      const fieldsToCreate = customFieldColumns
        .map(c => c.toLowerCase())
        .filter(name => !customFieldIds[name]);

      if (fieldsToCreate.length > 0) {
        const { data: newFields } = await supabase
          .from('custom_fields')
          .insert(fieldsToCreate.map(name => ({
            list_id: listId,
            field_name: name,
            field_type: 'text',
          })))
          .select();

        for (const field of newFields || []) {
          customFieldIds[field.field_name] = field.id;
        }
      }
    }

    // 2. Coletar todos os telefones primários para verificar duplicatas
    const allPrimaryPhones = contacts
      .map(c => c.phones[0])
      .filter(Boolean);

    // Buscar duplicatas existentes na lista (em lotes)
    const existingPhonesSet = new Set<string>();
    const batchSize = 500;
    
    for (let i = 0; i < allPrimaryPhones.length; i += batchSize) {
      const batch = allPrimaryPhones.slice(i, i + batchSize);
      const { data: existing } = await supabase
        .from('contacts')
        .select('phone')
        .eq('list_id', listId)
        .in('phone', batch);
      
      for (const contact of existing || []) {
        existingPhonesSet.add(contact.phone);
      }
    }

    // 3. Buscar chips oficiais de contatos existentes (em outras listas)
    const chipMap: { [phone: string]: string } = {};
    
    for (let i = 0; i < allPrimaryPhones.length; i += batchSize) {
      const batch = allPrimaryPhones.slice(i, i + batchSize);
      const { data: chips } = await supabase
        .from('contacts')
        .select('phone, preferred_connection_id')
        .in('phone', batch)
        .not('preferred_connection_id', 'is', null);
      
      for (const chip of chips || []) {
        if (!chipMap[chip.phone]) {
          chipMap[chip.phone] = chip.preferred_connection_id;
        }
      }
    }

    // 4. Filtrar contatos válidos (não duplicados)
    const validContacts = contacts.filter(c => 
      c.phones.length > 0 && !existingPhonesSet.has(c.phones[0])
    );

    console.log(`Valid contacts to import: ${validContacts.length} (${contacts.length - validContacts.length} duplicates/invalid)`);

    // 5. Inserir contatos em lotes
    let imported = 0;
    let chipsInherited = 0;
    const insertedContacts: { id: string; primaryPhone: string; phones: string[]; customData: { [key: string]: string } }[] = [];

    for (let i = 0; i < validContacts.length; i += batchSize) {
      const batch = validContacts.slice(i, i + batchSize);
      
      const contactsToInsert = batch.map(c => {
        const primaryPhone = c.phones[0];
        const inheritedChip = chipMap[primaryPhone] || null;
        
        if (inheritedChip) chipsInherited++;
        
        return {
          list_id: listId,
          name: c.name || primaryPhone,
          phone: primaryPhone,
          preferred_connection_id: inheritedChip,
        };
      });

      const { data: insertedBatch, error: insertError } = await supabase
        .from('contacts')
        .insert(contactsToInsert)
        .select('id, phone');

      if (insertError) {
        console.error('Batch insert error:', insertError);
        continue;
      }

      // Mapear IDs inseridos com dados originais
      for (const inserted of insertedBatch || []) {
        const original = batch.find(c => c.phones[0] === inserted.phone);
        if (original) {
          insertedContacts.push({
            id: inserted.id,
            primaryPhone: inserted.phone,
            phones: original.phones,
            customData: original.customData,
          });
          imported++;
        }
      }
    }

    console.log(`Inserted ${imported} contacts`);

    // 6. Inserir telefones em lotes
    let totalPhones = 0;
    const phonesToInsert: { contact_id: string; phone: string; is_primary: boolean; phone_type: string }[] = [];

    for (const contact of insertedContacts) {
      for (let j = 0; j < contact.phones.length; j++) {
        phonesToInsert.push({
          contact_id: contact.id,
          phone: contact.phones[j],
          is_primary: j === 0,
          phone_type: 'unknown',
        });
      }
    }

    for (let i = 0; i < phonesToInsert.length; i += batchSize) {
      const batch = phonesToInsert.slice(i, i + batchSize);
      const { error: phoneError } = await supabase
        .from('contact_phones')
        .insert(batch);
      
      if (!phoneError) {
        totalPhones += batch.length;
      } else {
        console.error('Phone batch insert error:', phoneError);
      }
    }

    console.log(`Inserted ${totalPhones} phone numbers`);

    // 7. Inserir dados customizados em lotes
    const customDataToInsert: { contact_id: string; field_id: string; value: string }[] = [];

    for (const contact of insertedContacts) {
      for (const [fieldName, value] of Object.entries(contact.customData)) {
        const fieldId = customFieldIds[fieldName.toLowerCase()];
        if (fieldId && value) {
          customDataToInsert.push({
            contact_id: contact.id,
            field_id: fieldId,
            value,
          });
        }
      }
    }

    for (let i = 0; i < customDataToInsert.length; i += batchSize) {
      const batch = customDataToInsert.slice(i, i + batchSize);
      await supabase.from('contact_custom_data').insert(batch);
    }

    console.log(`Inserted ${customDataToInsert.length} custom data entries`);

    // 8. Atualizar total de contatos na lista
    const { count } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId);

    await supabase
      .from('contact_lists')
      .update({ total_contacts: count || 0 })
      .eq('id', listId);

    const result = {
      imported,
      totalPhones,
      chipsInherited,
      duplicates: contacts.length - validContacts.length,
      skipped: contacts.length - imported - (contacts.length - validContacts.length),
    };

    console.log('Import complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
