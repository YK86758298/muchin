const authClient=supabaseClient;

function esc(v){
  return String(v ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function getNextPage(){
  const next=new URLSearchParams(location.search).get("next");
  return next && /^[a-zA-Z0-9_-]+\\.html(?:#[^]*)?$/.test(next) ? next : "account.html";
}

async function signOut(){
  await authClient.auth.signOut();
  location.href="index.html";
}

async function updateAccountLinks(){
  const {data:{session}}=await authClient.auth.getSession();
  document.querySelectorAll("[data-account-link]").forEach(link=>{
    link.href=session ? "account.html" : "login.html";
    link.textContent=session ? "My Account" : "Sign in";
  });
}

function toggleOrderDetails(id,button){
  const el=document.getElementById(id);
  if(!el)return;
  const open=!el.hidden;
  el.hidden=open;
  button.textContent=open ? "View details" : "Hide details";
}

function reorderItems(payload){
  try{
    const items=typeof payload==="string" ? JSON.parse(decodeURIComponent(payload)) : payload;
    const current=JSON.parse(localStorage.getItem("nova_shop_cart")||"[]");
    (items||[]).forEach(i=>{
      const qty=Math.max(1,Number(i.quantity)||1);
      const existing=current.find(x=>String(x.id)===String(i.product_id));
      if(existing)existing.qty+=qty;
      else current.push({id:i.product_id,name:i.product_name,price:Number(i.unit_price)||0,qty});
    });
    localStorage.setItem("nova_shop_cart",JSON.stringify(current));
    location.href="cart.html";
  }catch(err){
    console.error(err);
    alert("Unable to add the order to your cart.");
  }
}

async function cancelOrder(id,number){
  if(!confirm("Cancel order #"+number+"? This can only be done before payment is completed."))return;
  const {error}=await authClient.from("orders").update({
    status:"cancelled",
    cancelled_at:new Date().toISOString(),
    cancellation_reason:"Cancelled by customer"
  }).eq("id",id).eq("status","pending");
  if(error){
    alert("Unable to cancel this order: "+error.message);
    return;
  }
  location.reload();
}

async function initAuthPage(){
  await updateAccountLinks();
  const path=location.pathname.split("/").pop();

  if(path==="login.html"){
    const {data:{session},error:sessionError}=await authClient.auth.getSession();
    if(sessionError){
      const m=document.getElementById("auth-message");
      if(m)m.textContent="Unable to connect to the account service. Please refresh and try again.";
      return;
    }
    if(session){
      location.href=getNextPage();
      return;
    }
    const form=document.getElementById("login-form");
    if(!form)return;
    form.addEventListener("submit",async e=>{
      e.preventDefault();
      const m=document.getElementById("auth-message");
      const button=form.querySelector("button[type=submit]");
      m.textContent="Signing in...";
      if(button)button.disabled=true;
      try{
        const email=document.getElementById("email").value.trim();
        const password=document.getElementById("password").value;
        const {error}=await authClient.auth.signInWithPassword({email,password});
        if(error){
          m.textContent=error.message;
          return;
        }
        location.href=getNextPage();
      }catch(err){
        console.error(err);
        m.textContent="Unable to sign in. Please try again.";
      }finally{
        if(button)button.disabled=false;
      }
    });
  }

  else if(path==="register.html"){
    const form=document.getElementById("register-form");
    if(!form)return;
    form.addEventListener("submit",async e=>{
      e.preventDefault();
      const m=document.getElementById("auth-message");
      const p=document.getElementById("password").value;
      const confirmPassword=document.getElementById("confirm").value;
      if(p!==confirmPassword){
        m.textContent="Passwords do not match.";
        return;
      }
      m.textContent="Creating account...";
      const button=form.querySelector("button[type=submit]");
      if(button)button.disabled=true;
      try{
        const {data,error}=await authClient.auth.signUp({
          email:document.getElementById("email").value.trim(),
          password:p,
          options:{data:{full_name:document.getElementById("name").value.trim()}}
        });
        if(error){
          m.textContent=error.message;
          return;
        }
        if(data.session)location.href=getNextPage();
        else m.textContent="Account created. Please check your email to confirm your account, then sign in.";
      }catch(err){
        console.error(err);
        m.textContent="Unable to create the account. Please try again.";
      }finally{
        if(button)button.disabled=false;
      }
    });
  }

  else if(path==="account.html"){
    const {data:{session},error:sessionError}=await authClient.auth.getSession();
    if(sessionError || !session){
      location.href="login.html?next=account.html";
      return;
    }

    document.getElementById("account-email").textContent=session.user.email||"";
    const {data:orders,error}=await authClient.from("orders")
      .select("*")
      .eq("user_id",session.user.id)
      .order("created_at",{ascending:false});

    let items=[];
    const orderIds=(orders||[]).map(o=>o.id);
    if(!error && orderIds.length){
      const itemResult=await authClient.from("order_items")
        .select("order_id,product_id,product_name,quantity,unit_price")
        .in("order_id",orderIds);
      if(!itemResult.error)items=itemResult.data||[];
    }

    const box=document.getElementById("orders-list");
    if(error){
      box.innerHTML='<div class="card"><p>Unable to load your orders. Please try again later.</p></div>';
      return;
    }
    if(!orders.length){
      box.innerHTML='<div class="card empty-account"><p>You have no orders yet.</p><a class="btn" href="index.html#products">Start shopping</a></div>';
      return;
    }

    box.innerHTML=orders.map(o=>{
      const status=(o.status||"pending").toLowerCase();
      const orderItems=items.filter(i=>i.order_id===o.id);
      const detailsId="order-details-"+o.id;
      const detailRows=orderItems.length
        ? orderItems.map(i=>"<div class=\"order-item-row\"><span>"+esc(i.product_name||"Product")+"</span><span>"+esc(i.quantity)+" × $"+Number(i.unit_price||0).toFixed(2)+"</span><strong>$"+(Number(i.quantity||0)*Number(i.unit_price||0)).toFixed(2)+"</strong></div>").join("")
        : '<p class="order-empty-detail">No item details available.</p>';
      const shipping=[o.shipping_address,o.city,o.country].filter(Boolean).map(esc).join(", ");
      const tracking=o.tracking_number||"";
      const details="<div id=\""+detailsId+"\" class=\"order-details\" hidden><div class=\"order-detail-grid\"><div><small>Customer</small><span>"+esc(o.customer_name||"")+"</span></div><div><small>Email</small><span>"+esc(o.customer_email||session.user.email||"")+"</span></div><div><small>Shipping address</small><span>"+(shipping||"—")+"</span></div><div><small>Tracking number</small><span>"+(tracking?esc(tracking):"Not added yet")+"</span></div></div><div class=\"order-items-list\"><div class=\"order-items-head\"><span>Items</span><span>Unit price</span><span>Total</span></div>"+detailRows+"</div></div>";
      const encodedItems=encodeURIComponent(JSON.stringify(orderItems));
      const view="<button class=\"small-btn order-details-btn\" type=\"button\" onclick=\"toggleOrderDetails('"+detailsId+"',this)\">View details</button><button class=\"small-btn reorder-btn\" type=\"button\" onclick=\"reorderItems('"+encodedItems+"')\">Order again</button>";
      const cancel=status==="pending" ? "<button class=\"small-btn cancel-order-btn\" type=\"button\" onclick=\"cancelOrder('"+esc(o.id)+"','"+esc(o.order_number||o.id)+"')\">Cancel order</button>" : "";
      return '<article class="card account-order"><div class="account-order-main"><div><p class="eyebrow">Order</p><h2>#'+esc(o.order_number||o.id)+'</h2><small>'+esc(o.customer_name||"")+'</small></div><div class="account-order-actions">'+view+cancel+'</div></div><div class="account-order-meta"><span>'+esc(status)+'</span><strong>$'+Number(o.total||0).toFixed(2)+'</strong><small>'+new Date(o.created_at).toLocaleString()+'</small></div>'+details+'</article>';
    }).join("");
  }
}

window.toggleOrderDetails=toggleOrderDetails;
window.cancelOrder=cancelOrder;
window.reorderItems=reorderItems;
window.signOut=signOut;

document.addEventListener("DOMContentLoaded",()=>{
  if(document.getElementById("logout"))document.getElementById("logout").addEventListener("click",signOut);
  if(document.getElementById("footer-logout"))document.getElementById("footer-logout").addEventListener("click",signOut);
  initAuthPage().catch(err=>{
    console.error(err);
    const m=document.getElementById("auth-message");
    if(m)m.textContent="Unable to initialize the account page. Please refresh and try again.";
  });
});