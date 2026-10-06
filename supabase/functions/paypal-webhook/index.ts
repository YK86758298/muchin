// Production placeholder.
// Configure a PayPal webhook URL pointing to this function and verify the
// PayPal signature before changing order status. See README and PayPal docs.
Deno.serve(async(req)=>{
  if(req.method!=="POST") return new Response("Method Not Allowed",{status:405});
  const body=await req.text();
  console.log("PayPal webhook received",body);
  return new Response("OK",{status:200});
});
