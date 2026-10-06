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
