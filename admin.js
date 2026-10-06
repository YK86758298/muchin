async function loadOrders(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session){return;}
  const {data,error}=await supabaseClient.from("orders").select("*, order_items(*)").order("created_at",{ascending:false});
  const box=document.getElementById("orders");
  if(error){box.textContent=error.message;return;}
  box.innerHTML=data.map(o=>`<div class="card order">
    <h3>${o.order_number} — ${o.status}</h3>
    <p>${o.customer_name} · ${o.customer_email}</p>
    <p>${o.shipping_address}, ${o.city}, ${o.country}</p>
    <strong>$${Number(o.total).toFixed(2)}</strong>
    <div>${(o.order_items||[]).map(i=>`<div>${i.product_name} × ${i.quantity}</div>`).join("")}</div>
  </div>`).join("");
}
document.getElementById("login-form").onsubmit=async(e)=>{
 e.preventDefault();
 const {error}=await supabaseClient.auth.signInWithPassword({email:email.value,password:password.value});
 if(error){alert(error.message);return;}
 document.getElementById("login-box").style.display="none";loadOrders();
};
