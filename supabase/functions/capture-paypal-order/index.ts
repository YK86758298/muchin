import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
async function token(base:string){
  const id=Deno.env.get("PAYPAL_CLIENT_ID"), secret=Deno.env.get("PAYPAL_CLIENT_SECRET");
  if(!id||!secret) throw new Error("PayPal credentials are not configured");
  const basic=btoa(String(id)+":"+String(secret));
  const r=await fetch(base+"/v1/oauth2/token",{method:"POST",headers:{Authorization:"Basic "+basic,"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials"});
  const body=await r.text();
  if(!r.ok) throw new Error("PayPal authentication failed ("+r.status+"): "+body.slice(0,500));
  const data=JSON.parse(body); if(!data.access_token) throw new Error("PayPal authentication returned no access token");
  return data.access_token;
}
async function getPayPalOrder(base:string,t:string,id:string){
  const r=await fetch(base+"/v2/checkout/orders/"+id,{headers:{Authorization:"Bearer "+t,"Content-Type":"application/json"}});
  const body=await r.text();
  if(!r.ok) throw new Error("PayPal order lookup failed ("+r.status+"): "+body.slice(0,500));
  return JSON.parse(body);
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  let orderId:string|undefined;
  let paymentCaptured=false;
  try{
    ({paypal_order_id:orderId}=await req.json());
    const authHeader=req.headers.get("Authorization"); if(!authHeader) throw new Error("Authentication required");
    const authClient=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authHeader}}});
    const {data:{user},error:userError}=await authClient.auth.getUser(); if(userError||!user) throw new Error("Authentication required");
    const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let {data:order,error:orderError}=await sb.from("orders").select("id,total,currency,status").eq("paypal_order_id",orderId).eq("user_id",user.id).maybeSingle();
    if(orderError||!order) throw new Error("Order not found or not owned by current user");
    if(order.status==="paid") return new Response(JSON.stringify({ok:true}),{headers:{...cors,"Content-Type":"application/json"}});
    if(!["pending","payment_processing"].includes(order.status)) throw new Error("Order is not payable");
    if(order.status==="pending"){
      const {data:claimed}=await sb.from("orders").update({status:"payment_processing"}).eq("id",order.id).eq("user_id",user.id).eq("status","pending").select("id,total,currency,status").maybeSingle();
      if(claimed) order=claimed;
      else {
        const {data:locked}=await sb.from("orders").select("id,total,currency,status").eq("id",order.id).eq("user_id",user.id).maybeSingle();
        if(!locked) throw new Error("Order no longer exists");
        order=locked;
        if(order.status==="paid") return new Response(JSON.stringify({ok:true}),{headers:{...cors,"Content-Type":"application/json"}});
        if(order.status!=="payment_processing") throw new Error("Order is no longer payable");
      }
    }
    const base=Deno.env.get("PAYPAL_ENV")==="live"?"https://api-m.paypal.com":"https://api-m.sandbox.paypal.com";
    const t=await token(base);
    let result:any;
    const r=await fetch(base+"/v2/checkout/orders/"+orderId+"/capture",{method:"POST",headers:{Authorization:"Bearer "+t,"Content-Type":"application/json","PayPal-Request-Id":crypto.randomUUID()}});
    const body=await r.text();
    if(r.ok) result=JSON.parse(body);
    else {
      const current=await getPayPalOrder(base,t,orderId);
      if(current?.status!=="COMPLETED") throw new Error("PayPal capture failed ("+r.status+"): "+body.slice(0,1000));
      result=current;
    }
    const capture=result?.purchase_units?.[0]?.payments?.captures?.[0];
    const capturedAmount=Number(capture?.amount?.value);
    if(capture?.status!=="COMPLETED"||capture?.amount?.currency_code!==order.currency||!Number.isFinite(capturedAmount)||capturedAmount!==Number(order.total)) throw new Error("PayPal capture validation failed");
    paymentCaptured=true;
    const {data:completed,error:completeError}=await sb.rpc("complete_paid_order",{p_order_id:order.id,p_capture_id:capture.id});
    if(completeError||completed!==true) throw new Error(completeError?.message||"Unable to complete order inventory update");
    return new Response(JSON.stringify({ok:true}),{headers:{...cors,"Content-Type":"application/json"}});
  }catch(e){
    if(orderId && !paymentCaptured){
      try{
        const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await sb.from("orders").update({status:"pending"}).eq("paypal_order_id",orderId).eq("status","payment_processing");
      }catch{}
    }
    return new Response(JSON.stringify({error:String(e)}),{status:400,headers:{...cors,"Content-Type":"application/json"}});
  }
});