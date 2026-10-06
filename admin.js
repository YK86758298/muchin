const client = supabaseClient;

let editingProductId = null;


// ========================================
// LOGIN
// ========================================

const loginForm = document.getElementById("login-form");
const loginBox = document.getElementById("login-box");
const adminContent = document.getElementById("admin-content");
const logoutBtn = document.getElementById("logout-btn");


loginForm.addEventListener("submit", async function (e) {

  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Please enter your email and password.");
    return;
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    alert("Login failed: " + error.message);
    return;
  }

  if (data && data.user) {
    await showAdmin();
  }

});


// ========================================
// LOGOUT
// ========================================

logoutBtn.addEventListener("click", async function () {

  await client.auth.signOut();

  adminContent.style.display = "none";
  loginBox.style.display = "block";

});


// ========================================
// CHECK EXISTING SESSION
// ========================================

checkSession();


async function checkSession() {

  const {
    data: { session }
  } = await client.auth.getSession();

  if (session) {
    await showAdmin();
  }

}


// ========================================
// SHOW ADMIN
// ========================================

async function showAdmin() {

  loginBox.style.display = "none";
  adminContent.style.display = "block";

  await loadProducts();
  await loadOrders();

}


// ========================================
// LOAD PRODUCTS
// ========================================

async function loadProducts() {

  const { data, error } = await client
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    alert("Unable to load products: " + error.message);
    return;
  }

  const container = document.getElementById("products-admin");

  document.getElementById("product-count").textContent = data.length;

  if (!data.length) {

    container.innerHTML = `
      <div class="card empty-admin">
        <p>No products yet.</p>
      </div>
    `;

    return;
  }


  container.innerHTML = data.map(function (product) {

    const image = product.image_url
      ? `
        <img
          src="${escapeHtml(product.image_url)}"
          alt="${escapeHtml(product.name)}"
        >
      `
      : `
        <div class="product-image-placeholder">
          No image
        </div>
      `;


    return `
      <div class="admin-product-row">

        <div class="admin-product-image">
          ${image}
        </div>

        <div class="admin-product-info">

          <h3>
            ${escapeHtml(product.name)}
          </h3>

          <p>
            ${escapeHtml(product.description || "")}
          </p>

          <div class="admin-product-meta">

            <strong>
              $${Number(product.price).toFixed(2)}
            </strong>

            <span>
              Stock: ${product.stock}
            </span>

            <span class="${product.active ? "status-active" : "status-inactive"}">
              ${product.active ? "Active" : "Hidden"}
            </span>

          </div>

        </div>

        <div class="admin-product-actions">

          <button
            class="small-btn"
            onclick="editProduct('${product.id}')"
          >
            Edit
          </button>

          <button
            class="small-btn"
            onclick="toggleProduct('${product.id}', ${product.active})"
          >
            ${product.active ? "Hide" : "Publish"}
          </button>

          <button
            class="small-btn danger-btn"
            onclick="deleteProduct('${product.id}')"
          >
            Delete
          </button>

        </div>

      </div>
    `;

  }).join("");

}


// ========================================
// ADD PRODUCT
// ========================================

document.getElementById("add-product-btn").addEventListener(
  "click",
  function () {

    editingProductId = null;

    document.getElementById("product-form").reset();

    document.getElementById("product-id").value = "";

    document.getElementById("product-active").checked = true;

    document.getElementById("product-form-title").textContent =
      "Add Product";

    document.getElementById("product-form-message").textContent = "";

    document.getElementById("product-form-box").style.display =
      "block";

    document.getElementById("product-form-box").scrollIntoView({
      behavior: "smooth"
    });

  }
);


// ========================================
// CANCEL PRODUCT
// ========================================

document.getElementById("cancel-product-btn").addEventListener(
  "click",
  function () {

    document.getElementById("product-form-box").style.display =
      "none";

    editingProductId = null;

  }
);


// ========================================
// SAVE PRODUCT
// ========================================

document.getElementById("product-form").addEventListener(
  "submit",
  async function (e) {

    e.preventDefault();

    const name =
      document.getElementById("product-name").value.trim();

    const description =
      document.getElementById("product-description").value.trim();

    const price =
      Number(document.getElementById("product-price").value);

    const stock =
      Number(document.getElementById("product-stock").value);

    const image_url =
      document.getElementById("product-image").value.trim();

    const active =
      document.getElementById("product-active").checked;


    if (!name) {
      alert("Please enter a product name.");
      return;
    }

    if (Number.isNaN(price) || price < 0) {
      alert("Please enter a valid price.");
      return;
    }

    if (Number.isNaN(stock) || stock < 0) {
      alert("Please enter a valid stock quantity.");
      return;
    }


    const productData = {
      name: name,
      description: description,
      price: price,
      stock: stock,
      image_url: image_url,
      active: active
    };


    const message =
      document.getElementById("product-form-message");

    message.textContent = "Saving...";


    let result;


    if (editingProductId) {

      result = await client
        .from("products")
        .update(productData)
        .eq("id", editingProductId);

    } else {

      result = await client
        .from("products")
        .insert(productData);

    }


    if (result.error) {

      console.error(result.error);

      message.textContent =
        "Error: " + result.error.message;

      return;

    }


    message.textContent =
      "Saved successfully.";

    document.getElementById("product-form-box").style.display =
      "none";

    editingProductId = null;

    await loadProducts();

  }
);


// ========================================
// EDIT PRODUCT
// ========================================

window.editProduct = async function (id) {

  const { data, error } = await client
    .from("products")
    .select("*")
    .eq("id", id)
    .single();


  if (error) {

    alert(error.message);
    return;

  }


  editingProductId = id;


  document.getElementById("product-id").value =
    data.id;

  document.getElementById("product-name").value =
    data.name || "";

  document.getElementById("product-description").value =
    data.description || "";

  document.getElementById("product-price").value =
    data.price;

  document.getElementById("product-stock").value =
    data.stock;

  document.getElementById("product-image").value =
    data.image_url || "";

  document.getElementById("product-active").checked =
    data.active;


  document.getElementById("product-form-title").textContent =
    "Edit Product";

  document.getElementById("product-form-message").textContent =
    "";

  document.getElementById("product-form-box").style.display =
    "block";


  document.getElementById("product-form-box").scrollIntoView({
    behavior: "smooth"
  });

};


// ========================================
// HIDE / PUBLISH
// ========================================

window.toggleProduct = async function (id, currentStatus) {

  const { error } = await client
    .from("products")
    .update({
      active: !currentStatus
    })
    .eq("id", id);


  if (error) {

    alert(error.message);
    return;

  }


  await loadProducts();

};


// ========================================
// DELETE PRODUCT
// ========================================

window.deleteProduct = async function (id) {

  const confirmed = confirm(
    "Are you sure you want to delete this product?"
  );


  if (!confirmed) {
    return;
  }


  const { error } = await client
    .from("products")
    .delete()
    .eq("id", id);


  if (error) {

    alert(error.message);
    return;

  }


  await loadProducts();

};


// ========================================
// LOAD ORDERS
// ========================================

async function loadOrders() {

  const { data, error } = await client
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    document.getElementById("orders").innerHTML = `
      <div class="card">
        <p>Unable to load orders: ${escapeHtml(error.message)}</p>
      </div>
    `;
    return;
  }

  document.getElementById("order-count").textContent = data.length;

  if (!data.length) {
    document.getElementById("orders").innerHTML = `
      <div class="card empty-admin">
        <p>No orders yet.</p>
      </div>
    `;
    return;
  }

  document.getElementById("orders").innerHTML = data.map(function (order) {
    const status = (order.status || "pending").toLowerCase();
    const orderNumber = order.order_number || order.id;
    const safeId = escapeHtml(order.id);

    return `
      <article class="card admin-order">
        <div class="admin-order-top">
          <div>
            <span class="order-label">Order</span>
            <h3>#${escapeHtml(orderNumber)}</h3>
          </div>
          <span class="order-status admin-status-${escapeHtml(status)}">${escapeHtml(status)}</span>
        </div>

        <div class="admin-order-details">
          <p><strong>Customer:</strong> ${escapeHtml(order.customer_name || "")}</p>
          <p><strong>Email:</strong> ${escapeHtml(order.customer_email || "")}</p>
          <p><strong>Shipping:</strong> ${escapeHtml([order.shipping_address, order.city, order.country].filter(Boolean).join(", "))}</p>
          <p><strong>Total:</strong> $${Number(order.total || 0).toFixed(2)}</p>
          <p><strong>Date:</strong> ${order.created_at ? new Date(order.created_at).toLocaleString() : ""}</p>
          <p><strong>Tracking:</strong> ${escapeHtml(order.tracking_number || "Not added")}</p>
        </div>

        <div class="admin-order-update">
          <div class="admin-order-field">
            <label for="status-${safeId}">Order status</label>
            <select id="status-${safeId}" data-order-status="${safeId}">
              <option value="pending" ${status === "pending" ? "selected" : ""}>Pending</option>
              <option value="paid" ${status === "paid" ? "selected" : ""}>Paid</option>
              <option value="shipped" ${status === "shipped" ? "selected" : ""}>Shipped</option>
              <option value="cancelled" ${status === "cancelled" ? "selected" : ""}>Cancelled</option>
            </select>
          </div>
          <div class="admin-order-field">
            <label for="tracking-${safeId}">Tracking number</label>
            <input id="tracking-${safeId}" type="text" value="${escapeHtml(order.tracking_number || "")}" placeholder="Enter tracking number" data-order-tracking="${safeId}">
          </div>
          <button class="small-btn admin-order-save" type="button" onclick="updateOrder('${safeId}')">Save</button>
          <span id="order-message-${safeId}" class="admin-order-message"></span>
        </div>
      </article>
    `;
  }).join("");
}


// ========================================
// UPDATE ORDER
// ========================================

window.updateOrder = async function (id) {
  const status = document.querySelector('[data-order-status="' + id + '"]').value;
  const tracking = document.querySelector('[data-order-tracking="' + id + '"]').value.trim();
  const message = document.getElementById("order-message-" + id);

  message.textContent = "Saving...";

  const { error } = await client
    .from("orders")
    .update({
      status: status,
      tracking_number: tracking || null
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    message.textContent = "Error: " + error.message;
    return;
  }

  message.textContent = "Saved.";
  await loadOrders();
};

// ========================================
// ESCAPE HTML
// ========================================

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}
