const CART_KEY = "nova_shop_cart";

function getCart(){ return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
function saveCart(cart){ localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateCartCount(); }
function updateCartCount(){ const n=getCart().reduce((s,x)=>s+x.qty,0); document.querySelectorAll("#cart-count").forEach(x=>x.textContent=n); }

async function loadProducts(){
  const grid=document.getElementById("product-grid"); if(!grid)return;
  const {data,error}=await supabaseClient.from("products").select("*").eq("active",true).order("created_at",{ascending:false});
  if(error){grid.innerHTML="<p>Could not load products.</p>"; return;}
  grid.innerHTML=data.map(p=>`
    <article class="product card">
      <img src="${p.image_url || 'https://placehold.co/700x700?text=Product'}" alt="${p.name}">
      <div class="product-body"><h3>${p.name}</h3><p>${p.description||""}</p>
      <strong>$${Number(p.price).toFixed(2)}</strong>
      <button class="btn add" data-id="${p.id}">Add to cart</button></div>
    </article>`).join("");
  grid.querySelectorAll(".add").forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.id; const p=data.find(x=>x.id===id); const cart=getCart();
    const item=cart.find(x=>x.id===id); if(item)item.qty++; else cart.push({id:p.id,name:p.name,price:Number(p.price),qty:1});
    saveCart(cart); btn.textContent="Added"; setTimeout(()=>btn.textContent="Add to cart",700);
  });
}

async function loadCart(){
  const box=document.getElementById("cart"); if(!box)return;
  const cart=getCart();
  if(!cart.length){box.innerHTML="<p>Your cart is empty.</p>"; document.getElementById("cart-total").textContent=""; return;}
  box.innerHTML=cart.map(x=>`<div class="cart-row"><div><b>${x.name}</b><div>$${x.price.toFixed(2)} × ${x.qty}</div></div><button class="remove" data-id="${x.id}">Remove</button></div>`).join("");
  document.querySelectorAll(".remove").forEach(b=>b.onclick=()=>{saveCart(getCart().filter(x=>x.id!==b.dataset.id));loadCart();});
  const total=cart.reduce((s,x)=>s+x.price*x.qty,0);
  document.getElementById("cart-total").innerHTML=`<h2>Total: $${total.toFixed(2)}</h2>`;
}

updateCartCount();
loadProducts();
loadCart();

/*
 * Storefront content is controlled by the Muchin HTML/CSS.
 * Supabase site_settings is intentionally NOT applied here.
 *
 * Supabase remains the data source for products, orders and other
 * backend functionality, but old site_settings values must not
 * overwrite the Muchin storefront or cause a flash of legacy content.
 */
function loadSiteSettings(){ return Promise.resolve(); }
