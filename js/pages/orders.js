/**
 * ==========================================
 * AJP WEB CATALOG - Orders & Cart
 * ==========================================
 *
 * Cart disimpan di IndexedDB store "cart", keyPath: "kode"
 *
 * Flow:
 * 1. User klik "Tambah Order" di product card
 *    → CartModal.open(product) muncul
 *    → Isi carton/inner/pack/pcs + note
 *    → Klik "Tambah ke Cart" → simpan ke IndexedDB
 *    → Badge cart di navbar update
 *
 * 2. User klik menu "Order"
 *    → Tampilkan isi cart dari IndexedDB
 *    → Isi customer + nota
 *    → Submit → API.createOrder()
 */

// ==========================================
// CART — IndexedDB Operations
// ==========================================

const Cart = {

    STORE: "cart",

    async getAll() {
        return await Database.getAll(this.STORE);
    },

    async add(item) {
        // item.kode sebagai keyPath
        await Database.put(this.STORE, item);
        await Cart.updateBadge();
    },

    async remove(kode) {
        await Database.delete(this.STORE, kode);
        await Cart.updateBadge();
    },

    async clear() {
        await Database.clear(this.STORE);
        await Cart.updateBadge();
    },

    async count() {
        const items = await this.getAll();
        return items.length;
    },

    async updateBadge() {
        const count = await this.count();
        const badge = document.getElementById("cartBadge");

        if (!badge) return;

        badge.textContent = count;
        badge.style.display = count > 0 ? "inline-flex" : "none";
    }

};

// ==========================================
// CART MODAL — Modal dari Product Card
// ==========================================

const CartModal = {

    _product: null,

    open(product) {

        this._product = product;

        const modal =
            document.getElementById("cartModal");

        if (!modal) {
            this._injectModal();
        }

        this._populate(product);

        document.getElementById("cartModal").style.display = "flex";

    },

    _injectModal() {

        const el = document.createElement("div");

        el.innerHTML = `
            <div class="modal-overlay" id="cartModal" style="display:none">
                <div class="cart-modal">

                    <div class="cart-modal-header">
                        <h3 class="cart-modal-title">TAMBAH KE CART</h3>
                        <button id="cartModalClose" class="cart-modal-close">✕</button>
                    </div>

                    <div class="cart-modal-product">
                        <img id="cartModalImg" src="" alt="" class="cart-modal-img">
                        <div>
                            <p id="cartModalName" class="cart-modal-name"></p>
                            <p id="cartModalPrice" class="cart-modal-price"></p>
                            <p id="cartModalStock" class="cart-modal-stock"></p>
                        </div>
                    </div>

                    <div class="cart-qty-row">
                        ${["Carton","Inner","Pack","Pcs"].map(u => `
                            <div class="cart-qty-group">
                                <label>${u}</label>
                                <div class="qty-spinner">
                                    <button class="qty-btn" data-action="minus" data-unit="${u.toLowerCase()}">−</button>
                                    <input
                                        type="number"
                                        id="qty${u}"
                                        class="qty-input"
                                        value="0"
                                        min="0">
                                    <button class="qty-btn" data-action="plus" data-unit="${u.toLowerCase()}">+</button>
                                </div>
                            </div>
                        `).join("")}
                    </div>

                    <div class="form-group" style="margin-top:12px">
                        <label>Note (opsional)</label>
                        <input
                            type="text"
                            id="cartNote"
                            placeholder="Tulis catatan untuk item ini..."
                            class="form-input">
                    </div>

                    <div class="cart-modal-actions">
                        <button id="cartModalCancel" class="btn-secondary">Batal</button>
                        <button id="cartModalAdd" class="btn-primary">Tambah ke Cart</button>
                    </div>

                </div>
            </div>
        `;

        document.body.appendChild(el.firstElementChild);

        this._bindModalEvents();

    },

    _bindModalEvents() {

        document
            .getElementById("cartModalClose")
            ?.addEventListener("click", () => this.close());

        document
            .getElementById("cartModalCancel")
            ?.addEventListener("click", () => this.close());

        document
            .getElementById("cartModalAdd")
            ?.addEventListener("click", () => this._addToCart());

        // Spinner buttons
        document.querySelectorAll(".qty-btn").forEach(btn => {
            btn.addEventListener("click", () => {

                const unit   = btn.dataset.unit;
                const action = btn.dataset.action;
                const input  = document.getElementById(
                    "qty" + unit.charAt(0).toUpperCase() + unit.slice(1)
                );

                if (!input) return;

                let val = parseInt(input.value) || 0;

                val = action === "plus" ? val + 1 : Math.max(0, val - 1);

                input.value = val;

            });
        });

    },

    _populate(product) {

        const v = product.varianData[0];

        document.getElementById("cartModalImg").src =
            product.image || "";

        document.getElementById("cartModalName").textContent =
            product.nama_item +
            (v.varian && v.varian !== "-" ? ` — ${v.varian}` : "");

        const priceEl = document.getElementById("cartModalPrice");

        if (v.harga !== undefined && v.harga !== null) {
            priceEl.textContent =
                `Rp ${Number(v.harga).toLocaleString("id-ID")} / ${v.hargaType || ""}`;
            priceEl.style.display = "";
        } else {
            priceEl.style.display = "none";
        }

        document.getElementById("cartModalStock").textContent =
            `Stock: ${v.stock ?? 0}`;

        // Reset qty inputs
        ["Carton","Inner","Pack","Pcs"].forEach(u => {
            const el = document.getElementById("qty" + u);
            if (el) el.value = 0;
        });

        const noteEl = document.getElementById("cartNote");
        if (noteEl) noteEl.value = "";

    },

    async _addToCart() {

        const product = this._product;

        if (!product) return;

        const v = product.varianData[0];

        const carton = parseInt(document.getElementById("qtyCarton")?.value) || 0;
        const inner  = parseInt(document.getElementById("qtyInner")?.value)  || 0;
        const pack   = parseInt(document.getElementById("qtyPack")?.value)   || 0;
        const pcs    = parseInt(document.getElementById("qtyPcs")?.value)    || 0;
        const note   = document.getElementById("cartNote")?.value.trim() || "";

        if (carton === 0 && inner === 0 && pack === 0 && pcs === 0) {
            alert("Isi minimal satu jumlah (Carton / Inner / Pack / Pcs).");
            return;
        }

        const cartItem = {
            kode:       product.kode,
            nama_item:  product.nama_item,
            varian:     v.varian   || "-",
            harga:      v.harga    || 0,
            hargaType:  v.hargaType || "",
            image:      product.image || "",
            carton,
            inner,
            pack,
            pcs,
            note
        };

        await Cart.add(cartItem);

        this.close();

        // Refresh badge di nav
        await Cart.updateBadge();

    },

    close() {

        const modal = document.getElementById("cartModal");

        if (modal) modal.style.display = "none";

        this._product = null;

    }

};

// ==========================================
// ORDER PAGE — Tampilan Cart + Submit
// ==========================================

const OrderPage = {

    async init() {

        const container =
            document.getElementById("pageOrders");

        if (!container) return;

        container.innerHTML = this._renderHTML();

        this._bindEvents();
        await this._loadCart();

    },

    _renderHTML() {

        return `
            <div class="page-wrap">

                <div class="page-header">
                    <h2 class="page-title">Order</h2>
                </div>

                <!-- Form Info Order -->
                <div class="order-form-wrap">

                    <div class="form-group">
                        <label>Customer <span class="required">*</span></label>
                        <input
                            type="text"
                            id="orderCustomer"
                            placeholder="Nama customer / toko"
                            class="form-input">
                    </div>

                    <div class="form-group">
                        <label>Global Note (opsional)</label>
                        <input
                            type="text"
                            id="orderGlobalNote"
                            placeholder="Catatan umum untuk order ini"
                            class="form-input">
                    </div>

                </div>

                <!-- Cart Items -->
                <div id="orderCartWrap" class="order-cart-wrap">
                    <p class="table-loading">Memuat cart...</p>
                </div>

                <!-- Submit -->
                <div class="order-submit-row" id="orderSubmitRow" style="display:none">
                    <button id="btnClearCart" class="btn-secondary">Kosongkan Cart</button>
                    <button id="btnSubmitOrder" class="btn-primary btn-submit-order">
                        Kirim Order
                    </button>
                </div>

            </div>
        `;

    },

    _bindEvents() {

        document
            .getElementById("btnSubmitOrder")
            ?.addEventListener("click", () => this._doSubmit());

        document
            .getElementById("btnClearCart")
            ?.addEventListener("click", async () => {
                if (confirm("Kosongkan semua item dari cart?")) {
                    await Cart.clear();
                    await this._loadCart();
                }
            });

    },

    async _loadCart() {

        const wrap =
            document.getElementById("orderCartWrap");

        const submitRow =
            document.getElementById("orderSubmitRow");

        try {

            const items = await Cart.getAll();

            if (!items || items.length === 0) {

                wrap.innerHTML = `
                    <div class="cart-empty">
                        <p>Cart masih kosong.</p>
                        <p style="font-size:13px;color:#94A3B8">
                            Klik "Tambah Order" pada produk di halaman Produk.
                        </p>
                    </div>
                `;

                if (submitRow) submitRow.style.display = "none";

                return;

            }

            this._renderCart(items);

            if (submitRow) submitRow.style.display = "flex";

        } catch (err) {

            wrap.innerHTML =
                `<p class="table-error">❌ ${err.message}</p>`;

        }

    },

    _renderCart(items) {

        const wrap =
            document.getElementById("orderCartWrap");

        wrap.innerHTML = `
            <div class="cart-list">
                ${items.map(item => `
                    <div class="cart-item" data-kode="${item.kode}">

                        <img
                            src="${item.image}"
                            alt="${item.nama_item}"
                            class="cart-item-img"
                            onerror="this.style.display='none'">

                        <div class="cart-item-info">
                            <p class="cart-item-name">
                                ${item.nama_item}
                                ${item.varian && item.varian !== "-"
                                    ? `<span class="cart-item-varian">— ${item.varian}</span>`
                                    : ""}
                            </p>
                            <p class="cart-item-qty">
                                ${this._formatQty(item)}
                            </p>
                            ${item.harga
                                ? `<p class="cart-item-price">
                                    Rp ${Number(item.harga).toLocaleString("id-ID")}
                                    / ${item.hargaType}
                                   </p>`
                                : ""}
                            ${item.note
                                ? `<p class="cart-item-note">📝 ${item.note}</p>`
                                : ""}
                        </div>

                        <button
                            class="btn-remove-cart"
                            data-kode="${item.kode}"
                            title="Hapus dari cart">
                            ✕
                        </button>

                    </div>
                `).join("")}
            </div>
            <p class="cart-total">
                ${items.length} item dalam cart
            </p>
        `;

        // Bind hapus per item
        wrap.querySelectorAll(".btn-remove-cart").forEach(btn => {
            btn.addEventListener("click", async () => {
                await Cart.remove(btn.dataset.kode);
                await this._loadCart();
            });
        });

    },

    _formatQty(item) {

        const parts = [];

        if ((item.carton || 0) > 0) parts.push(`${item.carton} Carton`);
        if ((item.inner  || 0) > 0) parts.push(`${item.inner} Inner`);
        if ((item.pack   || 0) > 0) parts.push(`${item.pack} Pack`);
        if ((item.pcs    || 0) > 0) parts.push(`${item.pcs} Pcs`);

        return parts.length > 0 ? parts.join(" · ") : "-";

    },

    async _doSubmit() {

        const customer =
            document.getElementById("orderCustomer")?.value.trim();

        const globalNote =
            document.getElementById("orderGlobalNote")?.value.trim() || "";

        if (!customer) { alert("Customer wajib diisi."); return; }

        const items = await Cart.getAll();

        if (items.length === 0) {
            alert("Cart masih kosong.");
            return;
        }

        const btn = document.getElementById("btnSubmitOrder");
        btn.disabled    = true;
        btn.textContent = "Mengirim...";

        try {

            const result = await API.createOrder({
                customer,
                globalNote,
                items
            });

            if (result.status !== "success") {
                throw new Error(result.message);
            }

            await Cart.clear();
            alert("✓ Order berhasil dikirim!");

            document.getElementById("orderCustomer").value   = "";
            document.getElementById("orderGlobalNote").value = "";

            await this._loadCart();

        } catch (err) {

            alert(`❌ ${err.message}`);

        } finally {

            btn.disabled    = false;
            btn.textContent = "Kirim Order";

        }

    }

};

// ==========================================
// Entry points
// ==========================================

function loadOrders() {
    OrderPage.init();
}

// Dipanggil dari catalog.js saat klik "Tambah Order"
function openCartModal(product) {
    CartModal.open(product);
}
