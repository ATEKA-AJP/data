/**
 * ==========================================
 * AJP WEB CATALOG - Orders
 * ==========================================
 *
 * Flow:
 * 1. Sales tambah item ke Cart (bebas, tanpa nama dulu)
 * 2. Di halaman Order → beri nama customer → Kirim atau Simpan Draft
 * 3. "Mulai Cart Baru" → cart sekarang jadi draft → siap order baru
 * 4. Draft list → bisa dibuka, diedit, dikirim kapan saja
 *
 * IndexedDB stores:
 * - "cart"         → satu cart aktif (items tanpa nama), keyPath: "kode"
 * - "drafts"       → draft order bernama, keyPath: "id"
 * - "orderHistory" → riwayat terkirim (summary), keyPath: "id"
 */

// ==========================================
// CART — satu cart aktif (sementara, tanpa nama)
// ==========================================

const Cart = {

    async getAll() {
        return await Database.getAll("cart");
    },

    async add(item) {
        // item.kode sebagai keyPath → otomatis update kalau sudah ada
        await Database.put("cart", item);
        await this.updateBadge();
    },

    async remove(kode) {
        await Database.delete("cart", kode);
        await this.updateBadge();
    },

    async clear() {
        await Database.clear("cart");
        await this.updateBadge();
    },

    async count() {
        const items = await this.getAll();
        return items.length;
    },

    async updateBadge() {
        try {
            const count = await this.count();
            const badge = document.getElementById("cartBadge");
            if (!badge) return;
            badge.textContent   = count;
            badge.style.display = count > 0 ? "inline-flex" : "none";
        } catch {}
    }

};

// ==========================================
// ORDER STORAGE — drafts & history
// ==========================================

const OrderStorage = {

    async saveDraft(customer, items, globalNote = "") {
        const draft = {
            id:         "draft_" + Date.now(),
            customer:   customer.trim(),
            globalNote: globalNote.trim(),
            items:      items,
            createdAt:  new Date().toISOString(),
            updatedAt:  new Date().toISOString()
        };
        await Database.put("drafts", draft);
        return draft;
    },

    async getDraft(id) {
        return await Database.get("drafts", id);
    },

    async getAllDrafts() {
        const all = await Database.getAll("drafts");
        return all.sort((a, b) =>
            new Date(b.updatedAt) - new Date(a.updatedAt)
        );
    },

    async updateDraft(draft) {
        draft.updatedAt = new Date().toISOString();
        await Database.put("drafts", draft);
    },

    async deleteDraft(id) {
        await Database.delete("drafts", id);
    },

    async saveHistory(customer, itemCount) {
        await Database.put("orderHistory", {
            id:        "hist_" + Date.now(),
            customer,
            itemCount,
            sentAt:    new Date().toISOString()
        });
    },

    async getAllHistory() {
        const all = await Database.getAll("orderHistory");
        return all.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    },

    async cleanOldHistory() {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const all = await Database.getAll("orderHistory");
        for (const h of all) {
            if (new Date(h.sentAt) < cutoff) {
                await Database.delete("orderHistory", h.id);
            }
        }
    }

};

// ==========================================
// CART MODAL — tambah item ke cart aktif
// ==========================================

const CartModal = {

    _product: null,

    async open(product, activeIdx = 0) {
        this._product   = product;
        this._activeIdx = activeIdx;
        if (!document.getElementById("cartModal")) this._inject();
        this._populate(product, activeIdx);
        document.getElementById("cartModal").style.display = "flex";
    },

    _inject() {
        const el = document.createElement("div");
        el.innerHTML = `
            <div class="modal-overlay" id="cartModal" style="display:none">
                <div class="cart-modal">

                    <div class="cart-modal-header">
                        <h3 class="cart-modal-title">TAMBAH KE CART</h3>
                        <button id="cartModalClose" class="cart-modal-close">✕</button>
                    </div>

                    <div id="cartModalProduct"></div>

                    <div class="cart-qty-row">
                        ${["Carton","Inner","Pack","Pcs"].map(u => `
                            <div class="cart-qty-group">
                                <label>${u}</label>
                                <div class="qty-spinner">
                                    <button class="qty-btn" data-action="minus" data-unit="${u}">−</button>
                                    <input type="number" id="qty${u}" class="qty-input" value="0" min="0">
                                    <button class="qty-btn" data-action="plus" data-unit="${u}">+</button>
                                </div>
                            </div>
                        `).join("")}
                    </div>

                    <div class="form-group" style="margin-top:10px">
                        <label>Note (opsional)</label>
                        <input type="text" id="cartNote"
                            placeholder="Catatan untuk item ini..." class="form-input">
                    </div>

                    <div class="cart-modal-actions">
                        <button id="cartModalCancel" class="btn-secondary">Batal</button>
                        <button id="cartModalAdd" class="btn-primary">Tambah ke Cart</button>
                    </div>

                </div>
            </div>
        `;
        document.body.appendChild(el.firstElementChild);

        document.getElementById("cartModalClose")
            ?.addEventListener("click", () => this.close());
        document.getElementById("cartModalCancel")
            ?.addEventListener("click", () => this.close());
        document.getElementById("cartModalAdd")
            ?.addEventListener("click", () => this._addToCart());

        // Qty spinner via event delegation
        document.getElementById("cartModal")
            ?.addEventListener("click", (e) => {
                if (!e.target.classList.contains("qty-btn")) return;
                const unit  = e.target.dataset.unit;
                const input = document.getElementById("qty" + unit);
                if (!input) return;
                let val = parseInt(input.value) || 0;
                input.value = e.target.dataset.action === "plus"
                    ? val + 1 : Math.max(0, val - 1);
            });
    },

    _populate(product, activeIdx = 0) {
        const v = product.varianData[activeIdx] || product.varianData[0];

        const prodEl = document.getElementById("cartModalProduct");
        if (prodEl) {
            const packParts = [];
            if (v.inner  && v.inner  !== "-" && String(v.inner)  !== "0") packParts.push("Inner " + v.inner);
            if (v.carton && v.carton !== "-" && String(v.carton) !== "0") packParts.push("Carton " + v.carton);
            if (v.satuan && v.satuan !== "-") packParts.push(v.satuan);

            prodEl.innerHTML = `
                <div class="cart-modal-product">
                    <img src="${v.image || product.image || ""}" alt=""
                         class="cart-modal-img" onerror="this.style.display='none'">
                    <div>
                        <p class="cart-modal-name">
                            ${product.nama_item}
                            ${v.varian && v.varian !== "-"
                                ? '<span style="font-weight:400;color:#64748B"> — ' + v.varian + '</span>'
                                : ""}
                        </p>
                        ${v.harga !== undefined && v.harga !== null ?`
                            <p class="cart-modal-price">
                                Rp ${Number(v.harga).toLocaleString("id-ID")}
                                ${v.satuan ? "/ " + v.satuan : ""}
                            </p>` : ""}
                        <p class="cart-modal-stock">Stock: ${v.stock ?? 0}</p>
                        ${packParts.length > 0 ? '<p class="cart-modal-packaging">📦 ' + packParts.join(" / ") + '</p>' : ""}
                    </div>
                </div>
            `;
        }

        // Reset inputs
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

        const v      = product.varianData[this._activeIdx || 0];
        const carton = parseInt(document.getElementById("qtyCarton")?.value) || 0;
        const inner  = parseInt(document.getElementById("qtyInner")?.value)  || 0;
        const pack   = parseInt(document.getElementById("qtyPack")?.value)   || 0;
        const pcs    = parseInt(document.getElementById("qtyPcs")?.value)    || 0;
        const note   = document.getElementById("cartNote")?.value.trim() || "";

        if (carton === 0 && inner === 0 && pack === 0 && pcs === 0) {
            Notify.warn("Isi minimal satu jumlah (Carton / Inner / Pack / Pcs).");
            return;
        }

        await Cart.add({
            kode:      product.kode,
            nama_item: product.nama_item,
            varian:    v.varian    || "-",
            harga:     v.harga     || 0,
            satuan:    v.satuan    || "",
            hargaType: v.hargaType || "",
            image:     product.image || "",
            carton, inner, pack, pcs, note
        });

        this.close();
        Notify.success(`${product.nama_item} ditambahkan ke cart.`);

        // Refresh order page kalau sedang terbuka
        const orderPage = document.getElementById("pageOrders");
        if (orderPage && orderPage.style.display !== "none") {
            await OrderPage.refreshCart();
        }
    },

    close() {
        const modal = document.getElementById("cartModal");
        if (modal) modal.style.display = "none";
        this._product = null;
    }

};

// ==========================================
// ORDER PAGE
// ==========================================

const OrderPage = {

    // Draft yang sedang dibuka di detail view
    _openDraftId: null,

    async init() {
        const container = document.getElementById("pageOrders");
        if (!container) return;
        container.innerHTML = this._renderShell();
        await OrderStorage.cleanOldHistory();
        await this.refreshCart();
        await this._renderDraftList();
        await this._renderHistory();
    },

    _renderShell() {
        return `
            <div class="page-wrap">

                <!-- SECTION: Cart aktif -->
                <div class="page-header">
                    <h2 class="page-title">Cart</h2>
                </div>

                <div id="cartSectionWrap"></div>

                <!-- SECTION: Draft list -->
                <div id="draftSectionWrap"></div>

                <!-- SECTION: Detail draft yang dibuka -->
                <div id="draftDetailWrap" style="display:none"></div>

                <!-- SECTION: History -->
                <div id="orderHistoryWrap"></div>

            </div>
        `;
    },

    async refreshCart() {
        const wrap  = document.getElementById("cartSectionWrap");
        if (!wrap) return;

        const items = await Cart.getAll();
        await Cart.updateBadge();

        if (items.length === 0) {
            wrap.innerHTML = `
                <div class="order-empty" style="margin-bottom:24px">
                    <p>Cart kosong.</p>
                    <p style="font-size:13px;color:#94A3B8">
                        Pilih produk di halaman Produk lalu klik "Tambah Order".
                    </p>
                </div>
            `;
            return;
        }

        // Cek perubahan harga
        const warnings = this._checkPriceChanges(items);
        const hasWarnings = Object.keys(warnings).length > 0;

        wrap.innerHTML = `
            ${hasWarnings ? `
                <div class="price-warning-banner" style="margin-bottom:12px">
                    ⚠️ Ada ${Object.keys(warnings).length} item dengan perubahan harga.
                    Periksa sebelum kirim.
                </div>` : ""}

            <!-- Items -->
            <div class="cart-list" style="
                background:#fff;
                border:1px solid var(--border);
                border-radius:var(--radius);
                overflow:hidden;
                margin-bottom:16px;
            ">
                ${items.map(item => this._renderCartItem(item, warnings[item.kode])).join("")}
            </div>
            <p class="cart-total">${items.length} item dalam cart</p>

            <!-- Form checkout -->
            <div class="order-form-wrap" id="cartCheckoutForm">

                <div class="form-group">
                    <label>Nama Customer / Toko <span class="required">*</span></label>
                    <input type="text" id="cartCustomerName"
                        placeholder="Contoh: Toko Makmur" class="form-input">
                </div>

                <div class="form-group">
                    <label>Global Note (opsional)</label>
                    <input type="text" id="cartGlobalNote"
                        placeholder="Catatan umum untuk order ini" class="form-input">
                </div>

                <div class="cart-checkout-actions">
                    <button id="btnSaveDraft" class="btn-secondary">
                        💾 Simpan Draft
                    </button>
                    <button id="btnSendNow" class="btn-primary btn-submit-order">
                        Kirim Order Sekarang
                    </button>
                </div>

            </div>
        `;

        // Bind hapus per item
        wrap.querySelectorAll(".btn-remove-cart").forEach(btn => {
            btn.addEventListener("click", async () => {
                await Cart.remove(btn.dataset.kode);
                await this.refreshCart();
            });
        });

        // Simpan Draft
        document.getElementById("btnSaveDraft")
            ?.addEventListener("click", () => this._saveDraft());

        // Kirim Sekarang
        document.getElementById("btnSendNow")
            ?.addEventListener("click", () => this._sendNow());
    },

    _renderCartItem(item, priceWarn) {
        const parts = [];
        if ((item.carton || 0) > 0) parts.push(`${item.carton} Carton`);
        if ((item.inner  || 0) > 0) parts.push(`${item.inner} Inner`);
        if ((item.pack   || 0) > 0) parts.push(`${item.pack} Pack`);
        if ((item.pcs    || 0) > 0) parts.push(`${item.pcs} Pcs`);
        const qty = parts.join(" · ") || "-";

        return `
            <div class="cart-item">
                <img src="${item.image}" alt="" class="cart-item-img"
                    onerror="this.style.display='none'">
                <div class="cart-item-info">
                    <p class="cart-item-name">
                        ${item.nama_item}
                        ${item.varian && item.varian !== "-"
                            ? `<span class="cart-item-varian"> — ${item.varian}</span>` : ""}
                    </p>
                    <p class="cart-item-qty">${qty}</p>
                    ${item.harga
                        ? `<p class="cart-item-price ${priceWarn ? "price-changed" : ""}">
                            Rp ${Number(item.harga).toLocaleString("id-ID")}
                            ${item.satuan ? `/ ${item.satuan}` : ""}
                           </p>` : ""}
                    ${item.note
                        ? `<p class="cart-item-note">📝 ${item.note}</p>` : ""}
                    ${priceWarn ? `
                        <div class="price-warn-badge">
                            ⚠️ Harga berubah:
                            Rp ${Number(priceWarn.oldPrice).toLocaleString("id-ID")}
                            → Rp ${Number(priceWarn.newPrice).toLocaleString("id-ID")}
                        </div>` : ""}
                </div>
                <button class="btn-remove-cart" data-kode="${item.kode}">✕</button>
            </div>
        `;
    },

    _checkPriceChanges(items) {
        const warnings = {};
        items.forEach(item => {
            const cur = window._catalogProducts?.[item.kode]?.varianData?.[0];
            if (!cur) return;
            const cp = cur.harga;
            if (cp !== undefined && cp !== null && Number(cp) !== Number(item.harga)) {
                warnings[item.kode] = { oldPrice: item.harga, newPrice: cp };
            }
        });
        return warnings;
    },

    async _saveDraft() {
        const customer = document.getElementById("cartCustomerName")?.value.trim();
        const note     = document.getElementById("cartGlobalNote")?.value.trim() || "";

        if (!customer) { Notify.warn("Nama customer wajib diisi untuk menyimpan draft."); return; }

        const items = await Cart.getAll();
        if (items.length === 0) { Notify.warn("Cart kosong."); return; }

        await OrderStorage.saveDraft(customer, items, note);
        await Cart.clear();

        Notify.success(`Draft "${customer}" disimpan. Cart siap untuk order baru.`);

        await this.refreshCart();
        await this._renderDraftList();
    },

    async _sendNow() {
        const customer = document.getElementById("cartCustomerName")?.value.trim();
        const note     = document.getElementById("cartGlobalNote")?.value.trim() || "";

        if (!customer) { Notify.warn("Nama customer wajib diisi."); return; }

        const items = await Cart.getAll();
        if (items.length === 0) { Notify.warn("Cart kosong."); return; }

        // Cek perubahan harga
        const warnings = this._checkPriceChanges(items);
        if (Object.keys(warnings).length > 0) {
            const ok = await Notify.confirm(
                `⚠️ Ada ${Object.keys(warnings).length} item dengan perubahan harga.\nTetap kirim dengan harga di cart?`,
                "Ya, Kirim", "Batal"
            );
            if (!ok) return;
        }

        const btn = document.getElementById("btnSendNow");
        if (btn) { btn.disabled = true; btn.textContent = "Mengirim..."; }

        try {
            const result = await API.createOrder({ customer, globalNote: note, items });

            if (result.status !== "success") throw new Error(result.message);

            await OrderStorage.saveHistory(customer, items.length);
            await Cart.clear();

            Notify.success(`Order untuk "${customer}" berhasil dikirim!`);

            await this.refreshCart();
            await this._renderHistory();

        } catch (err) {
            Notify.error(err.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = "Kirim Order Sekarang"; }
        }
    },

    // ==========================================
    // DRAFT LIST
    // ==========================================

    async _renderDraftList() {
        const wrap = document.getElementById("draftSectionWrap");
        if (!wrap) return;

        const drafts = await OrderStorage.getAllDrafts();

        if (drafts.length === 0) {
            wrap.innerHTML = "";
            return;
        }

        wrap.innerHTML = `
            <h3 class="section-title" style="margin-top:32px">
                Draft Tersimpan (${drafts.length})
            </h3>
            <div class="draft-list">
                ${drafts.map(d => this._renderDraftCard(d)).join("")}
            </div>
        `;

        drafts.forEach(d => {
            document.getElementById(`btnOpenDraft_${d.id}`)
                ?.addEventListener("click", () => this._openDraft(d.id));
            document.getElementById(`btnDeleteDraft_${d.id}`)
                ?.addEventListener("click", () => this._deleteDraft(d.id));
        });
    },

    _renderDraftCard(draft) {
        const date = new Date(draft.updatedAt).toLocaleDateString("id-ID", {
            day: "2-digit", month: "short", year: "numeric"
        });
        return `
            <div class="draft-card">
                <div class="draft-card-info">
                    <p class="draft-card-customer">${draft.customer}</p>
                    <p class="draft-card-meta">${draft.items.length} item · ${date}</p>
                </div>
                <div class="draft-card-actions">
                    <button id="btnOpenDraft_${draft.id}" class="btn-primary btn-sm">
                        Buka / Kirim
                    </button>
                    <button id="btnDeleteDraft_${draft.id}"
                        class="btn-secondary btn-sm btn-danger">
                        Hapus
                    </button>
                </div>
            </div>
        `;
    },

    async _openDraft(draftId) {
        this._openDraftId = draftId;
        const draft       = await OrderStorage.getDraft(draftId);
        if (!draft) return;

        const priceWarnings = this._checkPriceChanges(draft.items);
        const hasWarnings   = Object.keys(priceWarnings).length > 0;

        const wrap = document.getElementById("draftDetailWrap");
        if (!wrap) return;

        wrap.style.display = "block";
        wrap.innerHTML = `
            <div class="draft-detail" style="margin-top:24px">

                <div class="draft-detail-header">
                    <div>
                        <h3 class="draft-detail-title">${draft.customer}</h3>
                        <p class="draft-detail-meta">${draft.items.length} item</p>
                    </div>
                    <button id="btnCloseDraft" class="btn-secondary btn-sm">✕ Tutup</button>
                </div>

                ${hasWarnings ? `
                    <div class="price-warning-banner">
                        ⚠️ Ada ${Object.keys(priceWarnings).length} item dengan perubahan harga.
                    </div>` : ""}

                <div class="draft-items">
                    ${draft.items.length === 0
                        ? `<p class="table-empty">Belum ada item.</p>`
                        : draft.items.map(item =>
                            this._renderCartItem(item, priceWarnings[item.kode])
                          ).join("")}
                </div>

                <div class="draft-send-form">
                    <div class="form-group">
                        <label>Global Note (opsional)</label>
                        <input type="text" id="draftGlobalNote"
                            value="${draft.globalNote || ""}"
                            placeholder="Catatan umum untuk order ini"
                            class="form-input">
                    </div>
                    <div class="draft-send-actions">
                        <button id="btnSendDraft" class="btn-primary btn-submit-order"
                            ${draft.items.length === 0 ? "disabled" : ""}>
                            Kirim Order ke ${draft.customer}
                        </button>
                    </div>
                </div>

            </div>
        `;

        wrap.scrollIntoView({ behavior: "smooth", block: "start" });

        document.getElementById("btnCloseDraft")?.addEventListener("click", () => {
            wrap.style.display = "none";
            this._openDraftId  = null;
        });

        document.getElementById("btnSendDraft")
            ?.addEventListener("click", () => this._sendDraft(draftId));
    },

    async _sendDraft(draftId) {
        const draft = await OrderStorage.getDraft(draftId);
        if (!draft || !draft.items.length) return;

        const note = document.getElementById("draftGlobalNote")?.value.trim() || "";
        draft.globalNote = note;
        await OrderStorage.updateDraft(draft);

        const warnings = this._checkPriceChanges(draft.items);
        if (Object.keys(warnings).length > 0) {
            const ok = await Notify.confirm(
                `⚠️ Ada ${Object.keys(warnings).length} item dengan perubahan harga.\nTetap kirim?`,
                "Ya, Kirim", "Batal"
            );
            if (!ok) return;
        }

        const btn = document.getElementById("btnSendDraft");
        if (btn) { btn.disabled = true; btn.textContent = "Mengirim..."; }

        try {
            const result = await API.createOrder({
                customer:   draft.customer,
                globalNote: draft.globalNote,
                items:      draft.items
            });

            if (result.status !== "success") throw new Error(result.message);

            await OrderStorage.saveHistory(draft.customer, draft.items.length);
            await OrderStorage.deleteDraft(draftId);

            Notify.success(`Order untuk "${draft.customer}" berhasil dikirim!`);

            document.getElementById("draftDetailWrap").style.display = "none";
            this._openDraftId = null;

            await this._renderDraftList();
            await this._renderHistory();

        } catch (err) {
            Notify.error(err.message);
            if (btn) {
                btn.disabled    = false;
                btn.textContent = `Kirim Order ke ${draft.customer}`;
            }
        }
    },

    async _deleteDraft(draftId) {
        const draft = await OrderStorage.getDraft(draftId);
        if (!draft) return;

        const ok = await Notify.confirm(
            `Hapus draft "${draft.customer}"?`,
            "Hapus", "Batal"
        );
        if (!ok) return;

        await OrderStorage.deleteDraft(draftId);

        if (this._openDraftId === draftId) {
            document.getElementById("draftDetailWrap").style.display = "none";
            this._openDraftId = null;
        }

        Notify.info(`Draft "${draft.customer}" dihapus.`);
        await this._renderDraftList();
    },

    // ==========================================
    // HISTORY
    // ==========================================

    async _renderHistory() {
        const wrap = document.getElementById("orderHistoryWrap");
        if (!wrap) return;

        const history = await OrderStorage.getAllHistory();
        if (history.length === 0) { wrap.innerHTML = ""; return; }

        wrap.innerHTML = `
            <h3 class="section-title" style="margin-top:32px">
                Riwayat Order (30 hari terakhir)
            </h3>
            <div class="history-list">
                ${history.map(h => {
                    const date = new Date(h.sentAt).toLocaleDateString("id-ID", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit"
                    });
                    return `
                        <div class="history-item">
                            <div>
                                <p class="history-customer">${h.customer}</p>
                                <p class="history-meta">${h.itemCount} item · ${date}</p>
                            </div>
                            <span class="status-badge status-open">Terkirim</span>
                        </div>`;
                }).join("")}
            </div>
        `;
    }

};

// ==========================================
// Entry points
// ==========================================

function loadOrders() {
    OrderPage.init();
}

function openCartModal(product) {
    CartModal.open(product);
}
