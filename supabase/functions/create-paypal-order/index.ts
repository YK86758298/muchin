import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};

async function paypalToken(base:string){
  const auth=btoa(`${Deno.env.get("PAYPAL_CLIENT_ID")}:${Deno.env.get("PAYPAL_CLIENT_SECRET")}`);
  const r=await fetch(`${base}/v1/oauth2/token`,{method:"POST",headers:{Authorization:`Basic ${auth}`,"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials"});
  if(!r.ok) throw new Error("PayPal authentication failed");
  return (await r.json()).access_token;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const {cart,customer}=await req.json();
    const authHeader=req.headers.get("Authorization");
    if(!authHeader) throw new Error("Authentication required");
    const authClient=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authHeader}}});
    const {data:{user},error:userError}=await authClient.auth.getUser();
    if(userError||!user) throw new Error("Authentication required");
    if(!Array.isArray(cart)||!cart.length) throw new Error("Cart is empty");
    if(!customer||!customer.name||!customer.email||!customer.address||!customer.city||!customer.country) throw new Error("Complete customer information is required");
    const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ids=cart.map((x:any)=>x.id);
    const {data:products,error}=await sb.from("products").select("id,name,price,stock,active").in("id",ids);
    if(error) throw error;
    const map=new Map(products.map((p:any)=>[p.id,p]));
    let total=0;
    const items=[];
    for(const item of cart){
      const p=map.get(item.id);
      const qty=Number(item.qty);
      if(!p||!p.active||!Number.isInteger(qty)||qty<1||qty>p.stock) throw new Error(`Invalid product or stock: ${item.id}`);
      total+=Number(p.price)*qty;
      items.push({product_id:p.id,product_name:p.name,quantity:qty,unit_price:p.price});
    }
    total=Number(total.toFixed(2));
    const base=Deno.env.get("PAYPAL_ENV")==="live"?"https://api-m.paypal.com":"https://api-m.sandbox.paypal.com";
    const token=await paypalToken(base);
    const pp=await fetch(`${base}/v2/checkout/orders`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json","PayPal-Request-Id":crypto.randomUUID()},body:JSON.stringify({
      intent:"CAPTURE",purchase_units:[{amount:{currency_code:"USD",value:total.toFixed(2)}}]
    })});
    if(!pp.ok) throw new Error(await pp.text());
    const order=await pp.json();
    const orderNumber=`NS-${Date.now()}`;
    const {data:dbOrder,error:dbError}=await sb.from("orders").insert({
      order_number:orderNumber,paypal_order_id:order.id,user_id:user.id,customer_name:customer.name,customer_email:customer.email,
      shipping_address:customer.address,city:customer.city,country:customer.country,total,currency:"USD",status:"pending"
    }).select().single();
    if(dbError) throw dbError;
    const {error:itemError}=await sb.from("order_items").insert(items.map(x=>({...x,order_id:dbOrder.id})));
    if(itemError){
      await sb.from("orders").delete().eq("id",dbOrder.id);
      throw itemError;
    }
    return new Response(JSON.stringify({id:order.id}),{headers:{...cors,"Content-Type":"application/json"}});
  }catch(e){return new Response(JSON.stringify({error:String(e)}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
});
