import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
async function token(base:string){const auth=btoa(`${Deno.env.get("PAYPAL_CLIENT_ID")}:${Deno.env.get("PAYPAL_CLIENT_SECRET")}`);const r=await fetch(`${base}/v1/oauth2/token`,{method:"POST",headers:{Authorization:`Basic ${auth}`,"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials"});return (await r.json()).access_token}
Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});try{
 const {paypal_order_id}=await req.json();
 const authHeader=req.headers.get("Authorization"); if(!authHeader) throw new Error("Authentication required");
 const authClient=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authHeader}}});
 const {data:{user},error:userError}=await authClient.auth.getUser(); if(userError||!user) throw new Error("Authentication required");
 const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 const {data:pendingOrder,error:orderError}=await sb.from("orders").select("id,total,currency,status").eq("paypal_order_id",paypal_order_id).eq("user_id",user.id).eq("status","pending").maybeSingle();
 if(orderError||!pendingOrder) throw new Error("Order not found or not owned by current user");
 const base=Deno.env.get("PAYPAL_ENV")==="live"?"https://api-m.paypal.com":"https://api-m.sandbox.paypal.com"; const t=await token(base);
 const r=await fetch(`${base}/v2/checkout/orders/${paypal_order_id}/capture`,{method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json","PayPal-Request-Id":crypto.randomUUID()}});
 if(!r.ok)throw new Error(await r.text()); const result=await r.json();
 const capture=result?.purchase_units?.[0]?.payments?.captures?.[0];
 const capturedAmount=Number(capture?.amount?.value);
 if(capture?.status!=="COMPLETED"||capture?.amount?.currency_code!==pendingOrder.currency||!Number.isFinite(capturedAmount)||capturedAmount!==Number(pendingOrder.total)) throw new Error("PayPal capture validation failed");
 const {data:completed,error:completeError}=await sb.rpc("complete_paid_order",{p_order_id:pendingOrder.id,p_capture_id:capture.id});
 if(completeError||completed!==true) throw new Error(completeError?.message||"Unable to complete order inventory update");
 return new Response(JSON.stringify({ok:true,result}),{headers:{...cors,"Content-Type":"application/json"}});
}catch(e){return new Response(JSON.stringify({error:String(e)}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}});