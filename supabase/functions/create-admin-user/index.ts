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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create regular client for checking caller permissions
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current user
    const { data: { user: caller }, error: userError } = await supabase.auth.getUser();
    if (userError || !caller) {
      throw new Error('Unauthorized');
    }

    // Check if caller is admin or super_admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .in('role', ['admin', 'super_admin'])
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('Not an admin or super_admin:', roleError);
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem criar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { email, fullName, role = 'admin', empresaId } = await req.json();

    if (!email || !fullName) {
      return new Response(
        JSON.stringify({ error: 'Email e nome completo são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure temporary password
    const tempPassword = crypto.randomUUID().slice(0, 12) + 'Aa1!';

    console.log('Creating user:', email);

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    // If user already exists, return friendly message without modifying
    if (existingUser) {
      console.log('User already exists:', existingUser.id);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Este email já está cadastrado no sistema. Verifique na lista de usuários.',
          isExistingUser: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      throw createError;
    }

    const userId = newUser.user!.id;
    console.log('User created:', userId);

    console.log('Creating profile...');

    // Upsert profile (create or update)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        full_name: fullName,
        approved: true,
        approved_at: new Date().toISOString(),
        approved_by: caller.id,
        empresa_id: empresaId || null
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Error upserting profile:', profileError);
      throw profileError;
    }

    console.log('Profile upserted, assigning role...');

    // Delete existing role and insert new one (user_roles doesn't have unique constraint on user_id)
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: role
      });

    if (roleInsertError) {
      console.error('Error assigning role:', roleInsertError);
      throw roleInsertError;
    }

    console.log('User setup completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email: email,
          fullName
        },
        tempPassword: tempPassword
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-admin-user:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
