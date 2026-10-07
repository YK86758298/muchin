const client = supabaseClient;
let editingProductId = null;

const loginForm = document.getElementById("login-form");
const loginBox = document.getElementById("login-box");
const adminContent = document.getElementById("admin-content");
const logoutBtn = document.getElementById("logout-btn");

loginForm.addEventListener("submit", async function(e){
  e.preventDefault();
  const email=document.getElementById("email").value.trim();
  const password=document.getElementById("password").value;
  if(!email||!password){alert("Please enter your email and password.");return;}
  const {data,error}=await client.auth.signInWithPassword({email,password});
  if(error){alert("Login failed: "+error.message);return;}
  if(data&&data.user)await showAdmin();
});

logoutBtn.addEventListener("click",async function(){
  await client.auth.signOut();
  adminContent.style.display="none";
  loginBox.style.display="block";
});

checkSession();

async function checkSession(){
  const {data:{session}}=await client.auth.getSession();
  if(session)await showAdmin();
}

async function showAdmin(){
  const {data:{session}}=await client.auth.getSession();
  const adminUserId="d1b14f21-8e54-4d16-8df8-b16eda8a1524";
  if(!session || session.user.id!==adminUserId){
    await client.auth.signOut();
    loginBox.style.display="block";
    adminContent.style.display="none";
    const formMessage=document.getElementById("login-form");
    if(formMessage) formMessage.dataset.adminNotice="Please sign in with the authorized admin account.";
    return;
  }
  loginBox.style.display="none";
  adminContent.style.display="block";
  await loadSiteSettings();
  await loadProducts();
  await loadOrders();
}

async function loadProducts(){
  const {data,error}=await client.from("products").select("*").order("created_at",{ascending:false});
  if(error){console.error(error);alert("Unable to load products: "+error.message);return;}

  const container=document.getElementById("products-admin");
  document.getElementById("product-count").textContent=data.length;

  if(!data.length){
    container.innerHTML='<div class="card empty-admin"><p>No products yet.</p></div>';
    return;
  }

  container.innerHTML=data.map(product=>{
    const image=product.image_url
      ? '<img src="'+escapeHtml(product.image_url)+'" alt="'+escapeHtml(product.name)+'">'
      : '<div class="product-image-placeholder">No image</div>';

    return `
      <div class="admin-product-row">
        <div class="admin-product-image">${image}</div>
        <div class="admin-product-info">
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.description||"")}</p>
          <div class="admin-product-meta">
            <strong>$${Number(product.price).toFixed(2)}</strong>
            <span>Stock: ${product.stock}</span>
            <span>${escapeHtml(product.category||"Other")}</span>
            ${product.best_seller?'<span class="admin-product-badge">Best Seller</span>':""}
            <span class="${product.active?"status-active":"status-inactive"}">${product.active?"Active":"Hidden"}</span>
          </div>
        </div>
        <div class="admin-product-actions">
          <button class="small-btn" onclick="editProduct('${product.id}')">Edit</button>
          <button class="small-btn" onclick="toggleProduct('${product.id}',${product.active})">${product.active?"Hide":"Publish"}</button>
          <button class="small-btn danger-btn" onclick="deleteProduct('${product.id}')">Delete</button>
        </div>
      </div>`;
  }).join("");
}


const PRODUCT_CSV_HEADERS=["name","description","price","stock","category","image_url","best_seller","active"];

document.getElementById("download-products-template")?.addEventListener("click",function(){
  const csv=PRODUCT_CSV_HEADERS.join(",")+"\n"+"Example Floral Napkin,Beautiful printed paper napkin,8.90,100,Paper Napkin,https://example.com/image.jpg,true,true\n";
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download="muchin-products-template.csv";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("import-products-btn")?.addEventListener("click",async function(){
  const input=document.getElementById("products-csv-file");
  const message=document.getElementById("bulk-import-message");
  const file=input?.files?.[0];
  if(!file){message.textContent="Choose a CSV file first.";return;}
  message.textContent="Reading CSV...";
  try{
    const text=await file.text();
    const rows=parseCSV(text.replace(/^\\uFEFF/,""));
    if(rows.length<2)throw new Error("The CSV must contain a header row and at least one product.");
    const headers=rows[0].map(x=>x.trim().toLowerCase());
    const missing=PRODUCT_CSV_HEADERS.filter(h=>!headers.includes(h));
    if(missing.length)throw new Error("Missing columns: "+missing.join(", "));
    const products=[];
    const errors=[];
    for(let i=1;i<rows.length;i++){
      const row=rows[i];
      if(row.every(v=>!String(v||"").trim()))continue;
      const obj={}; headers.forEach((h,idx)=>obj[h]=String(row[idx]??"").trim());
      const line=i+1;
      const name=obj.name;
      const price=Number(obj.price);
      const stock=Number(obj.stock||0);
      const category=obj.category||"Other";
      if(!name){errors.push("Line "+line+": name is required.");continue;}
      if(!Number.isFinite(price)||price<0){errors.push("Line "+line+": invalid price.");continue;}
      if(!Number.isInteger(stock)||stock<0){errors.push("Line "+line+": stock must be a whole number.");continue;}
      products.push({
        name,
        description:obj.description||"",
        price,
        stock,
        category,
        image_url:obj.image_url||"",
        best_seller:parseCSVBoolean(obj.best_seller,false),
        active:parseCSVBoolean(obj.active,true)
      });
    }
    if(errors.length)throw new Error(errors.slice(0,8).join(" ")+(errors.length>8?" And "+(errors.length-8)+" more errors.":""));
    if(!products.length)throw new Error("No valid products found.");
    message.textContent="Importing "+products.length+" products...";
    const chunkSize=100;
    for(let i=0;i<products.length;i+=chunkSize){
      const chunk=products.slice(i,i+chunkSize);
      const {error}=await client.from("products").insert(chunk);
      if(error)throw error;
    }
    message.textContent="Imported "+products.length+" products successfully.";
    input.value="";
    await loadProducts();
  }catch(error){
    console.error(error);
    message.textContent="Import failed: "+(error.message||String(error));
  }
});

function parseCSVBoolean(value,fallback){
  const v=String(value??"").trim().toLowerCase();
  if(!v)return fallback;
  if(["true","1","yes","y"].includes(v))return true;
  if(["false","0","no","n"].includes(v))return false;
  return fallback;
}

function parseCSV(text){
  const rows=[]; let row=[]; let cell=""; let quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"'){
        if(text[i+1]==='"'){cell+='"';i++;}
        else quoted=false;
      }else cell+=c;
    }else{
      if(c==='"' && cell==="")quoted=true;
      else if(c===','){row.push(cell);cell="";}
      else if(c==='\\n'){row.push(cell);rows.push(row);row=[];cell="";}
      else if(c!=='\\r')cell+=c;
    }
  }
  row.push(cell); rows.push(row);
  return rows;
}

document.getElementById("add-product-btn").addEventListener("click",function(){
  editingProductId=null;
  document.getElementById("product-form").reset();
  document.getElementById("product-id").value="";
  document.getElementById("product-active").checked=true;
  document.getElementById("product-best-seller").checked=false;
  document.getElementById("product-category").value="Other";
  document.getElementById("product-form-title").textContent="Add Product";
  document.getElementById("product-form-message").textContent="";
  document.getElementById("product-form-box").style.display="block";
  document.getElementById("product-form-box").scrollIntoView({behavior:"smooth"});
});

document.getElementById("cancel-product-btn").addEventListener("click",function(){
  document.getElementById("product-form-box").style.display="none";
  editingProductId=null;
});

document.getElementById("product-form").addEventListener("submit",async function(e){
  e.preventDefault();

  const name=document.getElementById("product-name").value.trim();
  const description=document.getElementById("product-description").value.trim();
  const price=Number(document.getElementById("product-price").value);
  const stock=Number(document.getElementById("product-stock").value);
  const image_url=document.getElementById("product-image").value.trim();
  const category=document.getElementById("product-category").value;
  const best_seller=document.getElementById("product-best-seller").checked;
  const active=document.getElementById("product-active").checked;

  if(!name){alert("Please enter a product name.");return;}
  if(Number.isNaN(price)||price<0){alert("Please enter a valid price.");return;}
  if(Number.isNaN(stock)||stock<0){alert("Please enter a valid stock quantity.");return;}

  const productData={name,description,price,stock,image_url,category,best_seller,active};
  const message=document.getElementById("product-form-message");
  message.textContent="Saving...";

  let result;
  if(editingProductId){
    result=await client.from("products").update(productData).eq("id",editingProductId);
  }else{
    result=await client.from("products").insert(productData);
  }

  if(result.error){console.error(result.error);message.textContent="Error: "+result.error.message;return;}

  message.textContent="Saved successfully.";
  document.getElementById("product-form-box").style.display="none";
  editingProductId=null;
  await loadProducts();
});

window.editProduct=async function(id){
  const {data,error}=await client.from("products").select("*").eq("id",id).single();
  if(error){alert(error.message);return;}

  editingProductId=id;
  document.getElementById("product-id").value=data.id;
  document.getElementById("product-name").value=data.name||"";
  document.getElementById("product-description").value=data.description||"";
  document.getElementById("product-price").value=data.price;
  document.getElementById("product-stock").value=data.stock;
  document.getElementById("product-image").value=data.image_url||"";
  document.getElementById("product-category").value=data.category||"Other";
  document.getElementById("product-best-seller").checked=!!data.best_seller;
  document.getElementById("product-active").checked=!!data.active;
  document.getElementById("product-form-title").textContent="Edit Product";
  document.getElementById("product-form-message").textContent="";
  document.getElementById("product-form-box").style.display="block";
  document.getElementById("product-form-box").scrollIntoView({behavior:"smooth"});
};

window.toggleProduct=async function(id,currentStatus){
  const {error}=await client.from("products").update({active:!currentStatus}).eq("id",id);
  if(error){alert(error.message);return;}
  await loadProducts();
};

window.deleteProduct=async function(id){
  if(!confirm("Are you sure you want to delete this product?"))return;
  const {error}=await client.from("products").delete().eq("id",id);
  if(error){alert(error.message);return;}
  await loadProducts();
};


const SITE_IMAGE_SETTINGS = [
  {key:"hero_image", label:"Hero Main Image", folder:"hero"},
  {key:"category_paper_napkin", label:"Paper Napkins", folder:"categories"},
  {key:"category_paper_cup", label:"Paper Cups", folder:"categories"},
  {key:"category_paper_plate", label:"Paper Plates", folder:"categories"},
  {key:"category_paper_bag", label:"Paper Bags", folder:"categories"},
  {key:"category_paper_tablecloth", label:"Paper Tablecloths", folder:"categories"},
  {key:"category_plastic_tablecloth", label:"Plastic Tablecloths", folder:"categories"},
  {key:"category_paper_banner", label:"Paper Banners", folder:"categories"},
  {key:"category_paper_hat", label:"Paper Hats", folder:"categories"}
];

async function loadSiteSettings(){
  const grid=document.getElementById("site-settings-grid");
  if(!grid)return;
  const {data,error}=await client.from("site_settings").select("key,value");
  if(error){grid.innerHTML='<div class="card"><p>Unable to load website settings.</p></div>';return;}
  const settings=Object.fromEntries((data||[]).map(x=>[x.key,x.value]));
  grid.innerHTML=SITE_IMAGE_SETTINGS.map(item=>{
    const url=settings[item.key]||"";
    return `
      <div class="card site-setting-card">
        <div class="site-setting-preview">
          ${url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(item.label)}">` : '<span>No image uploaded</span>'}
        </div>
        <div class="site-setting-body">
          <p class="eyebrow">${escapeHtml(item.folder)}</p>
          <h3>${escapeHtml(item.label)}</h3>
          <input type="file" accept="image/*" data-site-file="${escapeHtml(item.key)}">
          <button class="small-btn site-upload-btn" type="button" data-site-upload="${escapeHtml(item.key)}">Upload image</button>
          <span class="site-setting-status" data-site-status="${escapeHtml(item.key)}"></span>
        </div>
      </div>`;
  }).join("");

  grid.querySelectorAll("[data-site-upload]").forEach(btn=>{
    btn.addEventListener("click",()=>uploadSiteImage(btn.dataset.siteUpload));
  });
}

async function uploadSiteImage(key){
  const item=SITE_IMAGE_SETTINGS.find(x=>x.key===key);
  const input=document.querySelector(`[data-site-file="${key}"]`);
  const status=document.querySelector(`[data-site-status="${key}"]`);
  const file=input?.files?.[0];
  if(!item||!file){if(status)status.textContent="Choose an image first.";return;}
  if(!file.type.startsWith("image/")){status.textContent="Please choose an image file.";return;}
  if(file.size>8*1024*1024){status.textContent="Image must be 8MB or smaller.";return;}

  status.textContent="Uploading...";
  const formData=new FormData();
  formData.append("key",key);
  formData.append("folder",item.folder);
  formData.append("file",file,file.name);

  const {data,error}=await client.functions.invoke("upload-site-image",{body:formData});
  if(error){
    status.textContent="Upload failed: "+(error.message||"Unable to upload image.");
    return;
  }
  if(!data||!data.ok){
    status.textContent="Upload failed: "+(data?.error||"Unable to upload image.");
    return;
  }

  status.textContent="Saved.";
  await loadSiteSettings();
}

async function loadOrders(){
  const {data,error}=await client.from("orders").select("*").order("created_at",{ascending:false});
  if(error){
    console.error(error);
    document.getElementById("orders").innerHTML='<div class="card"><p>Unable to load orders: '+escapeHtml(error.message)+'</p></div>';
    return;
  }

  document.getElementById("order-count").textContent=data.length;
  if(!data.length){
    document.getElementById("orders").innerHTML='<div class="card empty-admin"><p>No orders yet.</p></div>';
    return;
  }

  document.getElementById("orders").innerHTML=data.map(function(order){
    const status=(order.status||"pending").toLowerCase();
    const orderNumber=order.order_number||order.id;
    const safeId=escapeHtml(order.id);
    return `
      <article class="card admin-order">
        <div class="admin-order-top">
          <div><span class="order-label">Order</span><h3>#${escapeHtml(orderNumber)}</h3></div>
          <span class="order-status admin-status-${escapeHtml(status)}">${escapeHtml(status)}</span>
        </div>
        <div class="admin-order-details">
          <p><strong>Customer:</strong> ${escapeHtml(order.customer_name||"")}</p>
          <p><strong>Email:</strong> ${escapeHtml(order.customer_email||"")}</p>
          <p><strong>Shipping:</strong> ${escapeHtml([order.shipping_address,order.city,order.country].filter(Boolean).join(", "))}</p>
          <p><strong>Total:</strong> $${Number(order.total||0).toFixed(2)}</p>
          <p><strong>Date:</strong> ${order.created_at?new Date(order.created_at).toLocaleString():""}</p>
          <p><strong>Tracking:</strong> ${escapeHtml(order.tracking_number||"Not added")}</p>
        </div>
        <div class="admin-order-update">
          <div class="admin-order-field">
            <label for="status-${safeId}">Order status</label>
            <select id="status-${safeId}" data-order-status="${safeId}">
              <option value="pending" ${status==="pending"?"selected":""}>Pending</option>
              <option value="paid" ${status==="paid"?"selected":""}>Paid</option>
              <option value="shipped" ${status==="shipped"?"selected":""}>Shipped</option>
              <option value="cancelled" ${status==="cancelled"?"selected":""}>Cancelled</option>
            </select>
          </div>
          <div class="admin-order-field">
            <label for="tracking-${safeId}">Tracking number</label>
            <input id="tracking-${safeId}" type="text" value="${escapeHtml(order.tracking_number||"")}" placeholder="Enter tracking number" data-order-tracking="${safeId}">
          </div>
          <button class="small-btn admin-order-save" type="button" onclick="updateOrder('${safeId}')">Save</button>
          <span id="order-message-${safeId}" class="admin-order-message"></span>
        </div>
      </article>`;
  }).join("");
}

window.updateOrder=async function(id){
  const status=document.querySelector('[data-order-status="'+id+'"]').value;
  const tracking=document.querySelector('[data-order-tracking="'+id+'"]').value.trim();
  const message=document.getElementById("order-message-"+id);
  message.textContent="Saving...";
  const {error}=await client.from("orders").update({status,tracking_number:tracking||null}).eq("id",id);
  if(error){console.error(error);message.textContent="Error: "+error.message;return;}
  message.textContent="Saved.";
  await loadOrders();
};

function escapeHtml(value){
  return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
