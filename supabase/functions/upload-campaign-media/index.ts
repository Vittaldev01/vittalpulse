import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Client with service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user with provided token
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📤 Upload requested by user: ${user.id}`);

    // Read form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const mediaType = formData.get("type") as string || "image";

    if (!file) {
      return new Response(
        JSON.stringify({ error: "Arquivo não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Arquivo muito grande. Máximo: 20MB" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    console.log(`📁 Uploading: ${fileName} (${file.size} bytes, type: ${mediaType})`);

    // Upload using service role (bypasses RLS)
    const { data, error: uploadError } = await supabase.storage
      .from("campaign-media")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("❌ Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("campaign-media")
      .getPublicUrl(fileName);

    console.log(`✅ Upload completed: ${publicUrl}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: publicUrl,
        fileName: fileName,
        size: file.size,
        type: mediaType
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error in upload-campaign-media:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
