async function checkoutInit(){
  const cart=getCart(); const summary=document.getElementById("checkout-summary"); const {data:{session}}=await supabaseClient.auth.getSession(); if(!session){window.location.href="login.html?next=checkout.html";return;}
  if(!cart.length){summary.innerHTML="<p>Your cart is empty.</p>";return;}
  const total=cart.reduce((s,x)=>s+x.price*x.qty,0);
  summary.innerHTML=`<h2>Order total: $${total.toFixed(2)}</h2>`+
    cart.map(x=>`<div>${x.name} × ${x.qty} — $${(x.price*x.qty).toFixed(2)}</div>`).join("");
  if(!window.paypal){document.getElementById("checkout-message").textContent="PayPal SDK not loaded.";return;}
  paypal.Buttons({
    createOrder: async ()=>{
      const form=document.getElementById("checkout-form");
      if(!form.reportValidity()) throw new Error("Please complete your details.");
      const customer=Object.fromEntries(new FormData(form).entries());
      const {data,error}=await supabaseClient.functions.invoke("create-paypal-order",{body:{cart,customer,user_id:session.user.id}});
      if(error) throw error; return data.id;
    },
    onApprove: async (data)=>{
      const {data:result,error}=await supabaseClient.functions.invoke("capture-paypal-order",{body:{paypal_order_id:data.orderID}});
      if(error) throw error;
      localStorage.removeItem(CART_KEY); updateCartCount();
      document.getElementById("checkout-message").textContent="Payment successful. Order received.";
      window.scrollTo(0,0);
    },
    onError:(err)=>{console.error(err);document.getElementById("checkout-message").textContent="Payment failed. Please try again.";}
  }).render("#paypal-button-container");
}
checkoutInit();
