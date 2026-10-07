Deno.serve(async(req)=>{
  if(req.method!=="POST") return new Response("Method Not Allowed",{status:405});
  return new Response(JSON.stringify({error:"PayPal webhook is not enabled for this store."}),{status:410,headers:{"Content-Type":"application/json"}});
});