import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({error:"Method not allowed"}), {status:405,headers:{...cors,"Content-Type":"application/json"}});

  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) return new Response(JSON.stringify({error:"Not authenticated"}), {status:401,headers:{...cors,"Content-Type":"application/json"}});

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({error:"Invalid session"}), {status:401,headers:{...cors,"Content-Type":"application/json"}});
    }

    const { data: adminRow, error: adminError } = await adminClient
      .from("admin_users").select("user_id").eq("user_id", userData.user.id).maybeSingle();
    if (adminError || !adminRow) {
      return new Response(JSON.stringify({error:"This account is not authorized as an admin."}), {status:403,headers:{...cors,"Content-Type":"application/json"}});
    }

    const form = await req.formData();
    const key = String(form.get("key") || "");
    const folder = String(form.get("folder") || "");
    const file = form.get("file");

    if (!key || !/^[a-z0-9_]+$/.test(key) || !["hero","categories"].includes(folder) || !(file instanceof File)) {
      return new Response(JSON.stringify({error:"Invalid upload data"}), {status:400,headers:{...cors,"Content-Type":"application/json"}});
    }
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      return new Response(JSON.stringify({error:"Image must be 8MB or smaller."}), {status:400,headers:{...cors,"Content-Type":"application/json"}});
    }

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = folder + "/" + key + "-" + Date.now() + "." + ext;
    const { error: uploadError } = await adminClient.storage.from("site-images").upload(path, file, {
      contentType: file.type,
      upsert: false
    });
    if (uploadError) {
      return new Response(JSON.stringify({error:uploadError.message}), {status:500,headers:{...cors,"Content-Type":"application/json"}});
    }

    const { data: publicData } = adminClient.storage.from("site-images").getPublicUrl(path);
    const url = publicData.publicUrl;

    const { error: saveError } = await adminClient.from("site_settings").upsert({
      key, value:url, updated_at:new Date().toISOString()
    });
    if (saveError) {
      await adminClient.storage.from("site-images").remove([path]);
      return new Response(JSON.stringify({error:saveError.message}), {status:500,headers:{...cors,"Content-Type":"application/json"}});
    }

    return new Response(JSON.stringify({ok:true,url}), {status:200,headers:{...cors,"Content-Type":"application/json"}});
  } catch (err) {
    return new Response(JSON.stringify({error:err instanceof Error ? err.message : "Upload failed"}), {status:500,headers:{...cors,"Content-Type":"application/json"}});
  }
});