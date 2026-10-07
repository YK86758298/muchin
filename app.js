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
function updateCartCount(){
  const n=getCart().reduce((s,x)=>s+x.qty,0);
  document.querySelectorAll("#cart-count").forEach(x=>x.textContent=n);
  const floatingCount=document.getElementById("floating-cart-count");
  if(floatingCount)floatingCount.textContent=n;
  const floatingCart=document.getElementById("floating-cart");
  if(floatingCart)floatingCart.classList.toggle("has-items",n>0);
}

function setupFloatingCart(){
  if(document.querySelector(".floating-cart") || location.pathname.endsWith("/cart.html") || location.pathname.endsWith("cart.html"))return;
  const link=document.createElement("a");
  link.href="cart.html";
  link.className="floating-cart";
  link.id="floating-cart";
  link.setAttribute("aria-label","Open shopping cart");
  link.innerHTML='<span class="floating-cart-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 7H6"/><circle cx="10" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/></svg></span><span class="floating-cart-label">Cart</span><span class="floating-cart-count" id="floating-cart-count">0</span>';
  document.body.appendChild(link);
  updateCartCount();
}

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
    else cart.push({id:p.id,name:p.name,price:Number(p.price),image_url:p.image_url || "",qty:1});
    saveCart(cart);
    btn.textContent="Added";
    setTimeout(()=>btn.textContent="Add to cart",700);
  });
}

let homepageProducts=[];
let currentShopCategory="best";
let currentShopPage=1;
const SHOP_PAGE_SIZE=8;

function categoryTitle(key){
  if(key==="best")return "Best Sellers";
  const found=CATEGORY_DEFS.find(x=>x.key===key);
  return found ? found.title : key;
}

function renderShop(){
  const grid=document.getElementById("shop-product-grid");
  const pager=document.getElementById("shop-pagination");
  const title=document.getElementById("shop-current-title");
  const eyebrow=document.getElementById("shop-current-eyebrow");
  if(!grid||!pager)return;

  const items=currentShopCategory==="best"
    ? homepageProducts.filter(p=>p.best_seller)
    : homepageProducts.filter(p=>String(p.category||"").toLowerCase()===currentShopCategory.toLowerCase());

  const totalPages=Math.max(1,Math.ceil(items.length/SHOP_PAGE_SIZE));
  currentShopPage=Math.min(currentShopPage,totalPages);
  const start=(currentShopPage-1)*SHOP_PAGE_SIZE;
  const pageItems=items.slice(start,start+SHOP_PAGE_SIZE);

  title.textContent=categoryTitle(currentShopCategory);
  eyebrow.textContent=currentShopCategory==="best" ? "CUSTOMER FAVORITES" : "COLLECTION";

  grid.innerHTML=pageItems.length
    ? pageItems.map(productCard).join("")
    : '<div class="shop-empty">No products in this category yet.</div>';
  bindProductButtons(pageItems,grid);

  pager.innerHTML=totalPages>1
    ? '<button type="button" class="shop-page-btn" data-page="-1" '+(currentShopPage===1?'disabled':'')+' aria-label="Previous page">←</button><span>'+currentShopPage+' / '+totalPages+'</span><button type="button" class="shop-page-btn" data-page="1" '+(currentShopPage===totalPages?'disabled':'')+' aria-label="Next page">→</button>'
    : '';

  pager.querySelectorAll(".shop-page-btn").forEach(btn=>{
    btn.onclick=()=>{
      currentShopPage+=Number(btn.dataset.page);
      renderShop();
      document.getElementById("products").scrollIntoView({behavior:"smooth",block:"start"});
    };
  });

  document.querySelectorAll("[data-shop-category]").forEach(el=>{
    el.classList.toggle("is-active",el.dataset.shopCategory===currentShopCategory);
  });
}

function selectShopCategory(category,scroll){
  currentShopCategory=category;
  currentShopPage=1;
  renderShop();
  if(scroll)document.getElementById("products")?.scrollIntoView({behavior:"smooth",block:"start"});
}

async function loadProducts(){
  const grid=document.getElementById("shop-product-grid");
  if(!grid)return;

  const {data,error}=await supabaseClient
    .from("products")
    .select("*")
    .eq("active",true)
    .order("created_at",{ascending:false});

  if(error){
    grid.innerHTML="<p>Could not load products.</p>";
    return;
  }

  homepageProducts=data||[];
  renderShop();

  document.querySelectorAll("[data-shop-category]").forEach(el=>{
    el.addEventListener("click",function(e){
      if(el.tagName==="A")e.preventDefault();
      selectShopCategory(el.dataset.shopCategory,true);
    });
  });
}

async function loadCart(){
  const box=document.getElementById("cart"); if(!box)return;
  let cart=getCart();
  if(!cart.length){box.innerHTML="<p>Your cart is empty.</p>"; document.getElementById("cart-total").textContent=""; return;}

  const missingIds=cart.filter(x=>!x.image_url).map(x=>x.id);
  if(missingIds.length){
    try{
      const {data}=await supabaseClient.from("products").select("id,image_url").in("id",missingIds);
      const imageMap=Object.fromEntries((data||[]).map(p=>[p.id,p.image_url]));
      cart=cart.map(x=>x.image_url ? x : {...x,image_url:imageMap[x.id] || ""});
      saveCart(cart);
    }catch(e){}
  }

  box.innerHTML=cart.map(x=>`<div class="cart-row">
    <div class="cart-item-info">
      <img class="cart-item-image" src="${escapeHtml(x.image_url || "https://placehold.co/160x160?text=Product")}" alt="${escapeHtml(x.name)}">
      <div class="cart-item-details">
        <b>${escapeHtml(x.name)}</b>
        <div class="cart-item-price">\${Number(x.price).toFixed(2)} each</div>
        <div class="cart-quantity">
          <button type="button" class="quantity-btn" data-action="minus" data-id="${escapeHtml(x.id)}" ${x.qty<=1?"disabled":""} aria-label="Decrease quantity">−</button>
          <span class="quantity-value">${x.qty}</span>
          <button type="button" class="quantity-btn" data-action="plus" data-id="${escapeHtml(x.id)}" aria-label="Increase quantity">+</button>
        </div>
      </div>
    </div>
    <div class="cart-item-actions">
      <strong class="cart-item-subtotal">\${(Number(x.price)*x.qty).toFixed(2)}</strong>
      <button class="remove" data-id="${escapeHtml(x.id)}">Remove</button>
    </div>
  </div>`).join("");
  document.querySelectorAll(".quantity-btn").forEach(b=>b.onclick=()=>{
    const cart=getCart();
    const item=cart.find(x=>x.id===b.dataset.id);
    if(!item)return;
    if(b.dataset.action==="plus")item.qty++;
    else if(item.qty>1)item.qty--;
    saveCart(cart);
    loadCart();
  });
  document.querySelectorAll(".remove").forEach(b=>b.onclick=()=>{
    saveCart(getCart().filter(x=>x.id!==b.dataset.id));
    loadCart();
  });
  const total=cart.reduce((s,x)=>s+Number(x.price)*x.qty,0);
  document.getElementById("cart-total").innerHTML=`<h2>Total: ${total.toFixed(2)}</h2>`;
}

setupFloatingCart();
updateCartCount();
loadProducts();
loadCart();
loadSiteSettings();

async function loadSiteSettings(){
  const hero=document.querySelector(".hero");
  const imageSlots=document.querySelectorAll("[data-site-image]");
  if(!hero && !imageSlots.length)return;
  const {data,error}=await supabaseClient.from("site_settings").select("key,value");
  if(error)return;
  const settings=Object.fromEntries((data||[]).map(x=>[x.key,x.value]));
  if(hero && settings.hero_image){
    hero.style.backgroundImage=`linear-gradient(90deg,rgba(245,242,235,0.98) 0%,rgba(245,242,235,0.85) 38%,rgba(245,242,235,0.2) 75%),url("${settings.hero_image}")`;
  }
  imageSlots.forEach(el=>{
    const url=settings[el.dataset.siteImage];
    if(url){
      localStorage.setItem("muchin_"+el.dataset.siteImage,url);
      el.style.backgroundImage=`url("${url}")`;
      el.classList.add("has-image");
    }
  });
}

loadSiteSettings();
