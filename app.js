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
updateCartCount(); loadProducts(); loadCart();


async function loadSiteSettings(){const r=await supabaseClient.from("site_settings").select("*").eq("id",true).maybeSingle(),d=r.data;if(!d)return;const b="MUCHIN";const a=document.getElementById("site-brand-name"),f=document.getElementById("footer-brand-name"),t=document.getElementById("site-title");if(a)a.textContent=b;if(f)f.textContent=b;if(t)t.textContent=b+" | Modern Tableware";const h=document.getElementById("hero-title");if(h)h.textContent=d.hero_title||"";const s=document.getElementById("hero-subtitle");if(s)s.textContent=d.hero_subtitle||"";const hero=document.getElementById("hero-section");if(hero&&d.hero_image_url)hero.style.backgroundImage="linear-gradient(90deg,rgba(245,242,235,.98),rgba(245,242,235,.2)),url(\""+d.hero_image_url+"\")";const pt=document.getElementById("philosophy-title"),px=document.getElementById("philosophy-text");if(pt)pt.textContent=d.philosophy_title||"";if(px)px.textContent=d.philosophy_text||"";[1,2,3].forEach(n=>{const ne=document.getElementById("category"+n+"-name"),ie=document.getElementById("category"+n+"-image"),im=d["category"+n+"_image_url"];if(ne)ne.textContent=d["category"+n+"_name"]||"";if(ie&&im)ie.style.backgroundImage="url(\""+im+"\")";});}loadSiteSettings();