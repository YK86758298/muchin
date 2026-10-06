import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
async function token(base:string){const auth=btoa(`${Deno.env.get("PAYPAL_CLIENT_ID")}:${Deno.env.get("PAYPAL_CLIENT_SECRET")}`);const r=await fetch(`${base}/v1/oauth2/token`,{method:"POST",headers:{Authorization:`Basic ${auth}`,"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials"});return (await r.json()).access_token}
Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});try{
 const {paypal_order_id}=await req.json(); const base=Deno.env.get("PAYPAL_ENV")==="live"?"https://api-m.paypal.com":"https://api-m.sandbox.paypal.com"; const t=await token(base);
 const r=await fetch(`${base}/v2/checkout/orders/${paypal_order_id}/capture`,{method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json","PayPal-Request-Id":crypto.randomUUID()}});
 if(!r.ok)throw new Error(await r.text()); const result=await r.json();
 const capture=result?.purchase_units?.[0]?.payments?.captures?.[0];
 const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 await sb.from("orders").update({status:"paid",paypal_capture_id:capture?.id}).eq("paypal_order_id",paypal_order_id);
 return new Response(JSON.stringify({ok:true,result}),{headers:{...cors,"Content-Type":"application/json"}});
}catch(e){return new Response(JSON.stringify({error:String(e)}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}});
