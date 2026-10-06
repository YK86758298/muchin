const CART_KEY = "nova_shop_cart";

const CATEGORY_DEFS = [
  { key: "Paper Napkin", title: "Paper Napkins", id: "category-paper-napkin" },
  { key: "Paper Cup", title: "Paper Cups", id: "category-paper-cup" },
  { key: "Paper Plate", title: "Paper Plates", id: "category-paper-plate" },
  { key: "Paper Bag", title: "Paper Bags", id: "category-paper-bag" },
  { key: "Paper Tablecloth", title: "Paper Tablecloths", id: "category-paper-tablecloth" },
  { key: "Plastic Tablecloth", title: "Plastic Tablecloths", id: "category-plastic-tablecloth" },
  { key: "Paper Banner", title: "Paper Banners", id: "category-paper-banner" },
  { key: "Paper Hat", title: "Paper Hats", id: "category-paper-hat" }
];

function getCart(){ return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
function saveCart(cart){ localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateCartCount(); }
function updateCartCount(){ const n=getCart().reduce((s,x)=>s+x.qty,0); document.querySelectorAll("#cart-count").forEach(x=>x.textContent=n); }

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function productCard(p){
  return `
    <article class="product card">
      <img src="${escapeHtml(p.image_url || "https://placehold.co/700x700?text=Product")}" alt="${escapeHtml(p.name)}">
      <div class="product-body">
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.description || "")}</p>
        <strong>$${Number(p.price).toFixed(2)}</strong>
        <button class="btn add" data-id="${escapeHtml(p.id)}">Add to cart</button>
      </div>
    </article>`;
}

function bindProductButtons(data, root){
  root.querySelectorAll(".add").forEach(btn=>btn.onclick=()=>{
    const id=btn.dataset.id;
    const p=data.find(x=>x.id===id);
    if(!p)return;
    const cart=getCart();
    const item=cart.find(x=>x.id===id);
    if(item)item.qty++;
    else cart.push({id:p.id,name:p.name,price:Number(p.price),qty:1});
    saveCart(cart);
    btn.textContent="Added";
    setTimeout(()=>btn.textContent="Add to cart",700);
  });
}

async function loadProducts(){
  const bestGrid=document.getElementById("best-sellers-grid");
  const categoryRoot=document.getElementById("category-products");
  if(!bestGrid || !categoryRoot)return;

  const {data,error}=await supabaseClient
    .from("products")
    .select("*")
    .eq("active",true)
    .order("created_at",{ascending:false});

  if(error){
    bestGrid.innerHTML="<p>Could not load products.</p>";
    return;
  }

  const products=data || [];
  const bestSellers=products.filter(p=>p.best_seller);

  if(bestSellers.length){
    bestGrid.innerHTML=bestSellers.slice(0,8).map(productCard).join("");
    bindProductButtons(bestSellers,bestGrid);
  }else{
    document.getElementById("best-sellers-section").style.display="none";
  }

  categoryRoot.innerHTML=CATEGORY_DEFS.map(category=>{
    const items=products.filter(p=>String(p.category||"").toLowerCase()===category.key.toLowerCase());
    if(!items.length)return "";
    return `
      <section class="product-category-block" id="${category.id}">
        <div class="product-category-heading">
          <div>
            <p class="eyebrow">COLLECTION</p>
            <h3>${category.title}</h3>
          </div>
          <a href="shop.html?category=${encodeURIComponent(category.key)}" class="text-link">View all →</a>
        </div>
        <div class="grid">${items.slice(0,8).map(productCard).join("")}</div>
      </section>`;
  }).join("");

  CATEGORY_DEFS.forEach(category=>{
    const section=document.getElementById(category.id);
    if(section)bindProductButtons(products.filter(p=>String(p.category||"").toLowerCase()===category.key.toLowerCase()),section);
  });
}

async function loadCart(){
  const box=document.getElementById("cart"); if(!box)return;
  const cart=getCart();
  if(!cart.length){box.innerHTML="<p>Your cart is empty.</p>"; document.getElementById("cart-total").textContent=""; return;}
  box.innerHTML=cart.map(x=>`<div class="cart-row"><div><b>${escapeHtml(x.name)}</b><div>$${x.price.toFixed(2)} × ${x.qty}</div></div><button class="remove" data-id="${escapeHtml(x.id)}">Remove</button></div>`).join("");
  document.querySelectorAll(".remove").forEach(b=>b.onclick=()=>{saveCart(getCart().filter(x=>x.id!==b.dataset.id));loadCart();});
  const total=cart.reduce((s,x)=>s+x.price*x.qty,0);
  document.getElementById("cart-total").innerHTML=`<h2>Total: $${total.toFixed(2)}</h2>`;
}

updateCartCount();
loadProducts();
loadCart();

function loadSiteSettings(){ return Promise.resolve(); }
