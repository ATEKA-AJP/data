/**
 * ==========================================
 * AJP WEB CATALOG - Orders (Draft System)
 * ==========================================
 *
 * Konsep:
 * - Sales bisa punya banyak draft sekaligus (Toko A, Toko B, dll)
 * - Setiap draft berisi: customer, items, globalNote, status
 * - Status: "draft" (belum kirim) | "sent" (sudah kirim)
 * - Sebelum kirim: cek apakah ada item yang harganya berubah
 * - History (sent): hanya simpan nama toko, jumlah item, tanggal
 * - History dihapus otomatis setelah 30 hari
 *
 * IndexedDB:
 * - "drafts"      → draft order belum kirim, keyPath: "id"
 * - "orderHistory" → order sudah kirim (summary only), keyPath: "id"
 */

// ==========================================
// ORDER STORAGE
// ==========================================

const OrderStorage = {

    // --- DRAFTS ---

    async createDraft(customer) {
        const draft = {
            id:          "draft_" + Date.now(),
            customer:    customer.trim(),
            globalNote:  "",
            items:       [],
            status:      "draft",
            createdAt:   new Date().toISOString(),
            updatedAt:   new Date().toISOString()
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

    async saveDraft(draft) {
        draft.updatedAt = new Date().toISOString();
        await Database.put("drafts", draft);
    },

    async deleteDraft(id) {
        await Database.delete("drafts", id);
    },

    async addItemToDraft(draftId, item) {
        const draft = await this.getDraft(draftId);
        if (!draft) throw new Error("Draft tidak ditemukan.");

        // Update item jika kode sudah ada, tambah jika belum
        const idx = draft.items.findIndex(i => i.kode === item.kode);
        if (idx >= 0) {
            draft.items[idx] = { ...draft.items[idx], ...item };
        } else {
            draft.items.push(item);
        }

        await this.saveDraft(draft);
        return draft;
    },

    async removeItemFromDraft(draftId, kode) {
        const draft = await this.getDraft(draftId);
        if (!draft) return;
        draft.items = draft.items.filter(i => i.kode !== kode);
        await this.saveDraft(draft);
        return draft;
    },

    // --- HISTORY ---

    async saveHistory(draft) {
        const history = {
            id:        draft.id,
            customer:  draft.customer,
            itemCount: draft.items.length,
            sentAt:    new Date().toISOString()
        };
        await Database.put("orderHistory", history);
        return history;
    },

    async getAllHistory() {
        const all = await Database.getAll("orderHistory");
        return all.sort((a, b) =>
            new Date(b.sentAt) - new Date(a.sentAt)
        );
    },

    // Hapus history yang sudah lebih dari 30 hari
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
// CART BADGE (update dari drafts)
// ==========================================

const Cart = {

    async updateBadge() {
        try {
            const drafts = await OrderStorage.getAllDrafts();
            const totalItems = drafts.reduce(
                (sum, d) => sum + d.items.length, 0
            );
            const badge = document.getElementById("cartBadge");
            if (!badge) return;
            badge.textContent = totalItems;
            badge.style.display = totalItems > 0 ? "inline-flex" : "none";
        } catch {
            // ignore
        }
    }

};

// ==========================================
// CART MODAL — Tambah item ke draft
// ==========================================

const CartModal = {

    _product:  null,
    _draftId:  null,

    async open(product) {
        this._product = product;

        const modal = document.getElementById("cartModal");
        if (!modal) this._injectModal();

        await this._populateDraftPicker();
        this._populate(product);
        document.getElementById("cartModal").style.display = "flex";
    },

    _injectModal() {
        const el = document.createElement("div");
        el.innerHTML = `
            <div class="modal-overlay" id="cartModal" style="display:none">
                <div class="cart-modal">

                    <div class="cart-modal-header">
                        <h3 class="cart-modal-title">TAMBAH KE ORDER</h3>
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

                    <!-- Pilih atau buat draft -->
                    <div class="form-group">
                        <label>Customer / Toko</label>
                        <div class="draft-picker-wrap">
                            <select id="cartDraftSelect" class="form-input">
                                <option value="">-- Pilih draft atau buat baru --</option>
                            </select>
                            <div id="cartNewCustomerWrap" style="display:none;margin-top:8px">
                                <input
                                    type="text"
                                    id="cartNewCustomer"
                                    placeholder="Nama toko baru..."
                                    class="form-input">
                            </div>
                        </div>
                    </div>

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

                    <div class="form-group" style="margin-top:8px">
                        <label>Note (opsional)</label>
                        <input type="text" id="cartNote" placeholder="Catatan untuk item ini..." class="form-input">
                    </div>

                    <div class="cart-modal-actions">
                        <button id="cartModalCancel" class="btn-secondary">Batal</button>
                        <button id="cartModalAdd" class="btn-primary">Tambah ke Draft</button>
                    </div>

                </div>
            </div>
        `;
        document.body.appendChild(el.firstElementChild);
        this._bindModalEvents();
    },

    _bindModalEvents() {
        document.getElementById("cartModalClose")
            ?.addEventListener("click", () => this.close());
        document.getElementById("cartModalCancel")
            ?.addEventListener("click", () => this.close());
        document.getElementById("cartModalAdd")
            ?.addEventListener("click", () => this._addToCart());

        document.getElementById("cartDraftSelect")
            ?.addEventListener("change", (e) => {
                const wrap = document.getElementById("cartNewCustomerWrap");
                if (wrap) wrap.style.display = e.target.value === "new" ? "block" : "none";
            });

        document.querySelectorAll(".qty-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const unit  = btn.dataset.unit;
                const input = document.getElementById("qty" + unit);
                if (!input) return;
                let val = parseInt(input.value) || 0;
                input.value = btn.dataset.action === "plus"
                    ? val + 1
                    : Math.max(0, val - 1);
            });
        });
    },

    async _populateDraftPicker() {
        const select = document.getElementById("cartDraftSelect");
        if (!select) return;

        const drafts = await OrderStorage.getAllDrafts();

        select.innerHTML = `<option value="">-- Pilih draft atau buat baru --</option>`;

        drafts.forEach(d => {
            select.innerHTML += `
                <option value="${d.id}">
                    ${d.customer} (${d.items.length} item)
                </option>`;
        });

        select.innerHTML += `<option value="new">+ Buat draft baru...</option>`;
    },

    _populate(product) {
        const v = product.varianData[0];

        document.getElementById("cartModalImg").src  = product.image || "";
        document.getElementById("cartModalName").textContent =
            product.nama_item + (v.varian && v.varian !== "-" ? ` — ${v.varian}` : "");

        const priceEl = document.getElementById("cartModalPrice");
        if (v.harga !== undefined && v.harga !== null) {
            priceEl.textContent =
                `Rp ${Number(v.harga).toLocaleString("id-ID")} / ${v.hargaType || v.satuan || ""}`;
            priceEl.style.display = "";
        } else {
            priceEl.style.display = "none";
        }

        document.getElementById("cartModalStock").textContent =
            `Stock: ${v.stock ?? 0} ${v.satuan || ""}`;

        ["Carton","Inner","Pack","Pcs"].forEach(u => {
            const el = document.getElementById("qty" + u);
            if (el) el.value = 0;
        });
        const noteEl = document.getElementById("cartNote");
        if (noteEl) noteEl.value = "";
    },

    async _addToCart() {
        const product    = this._product;
        const draftIdRaw = document.getElementById("cartDraftSelect")?.value;

        if (!draftIdRaw) {
            alert("Pilih draft atau buat draft baru terlebih dahulu.");
            return;
        }

        const carton = parseInt(document.getElementById("qtyCarton")?.value) || 0;
        const inner  = parseInt(document.getElementById("qtyInner")?.value)  || 0;
        const pack   = parseInt(document.getElementById("qtyPack")?.value)   || 0;
        const pcs    = parseInt(document.getElementById("qtyPcs")?.value)    || 0;
        const note   = document.getElementById("cartNote")?.value.trim() || "";

        if (carton === 0 && inner === 0 && pack === 0 && pcs === 0) {
            alert("Isi minimal satu jumlah (Carton / Inner / Pack / Pcs).");
            return;
        }

        const v = product.varianData[0];

        const cartItem = {
            kode:       product.kode,
            nama_item:  product.nama_item,
            varian:     v.varian   || "-",
            harga:      v.harga    || 0,
            hargaType:  v.hargaType || "",
            satuan:     v.satuan   || "",
            image:      product.image || "",
            carton, inner, pack, pcs, note
        };

        let draftId = draftIdRaw;

        if (draftIdRaw === "new") {
            const newName = document.getElementById("cartNewCustomer")?.value.trim();
            if (!newName) { alert("Nama toko wajib diisi."); return; }
            const newDraft = await OrderStorage.createDraft(newName);
            draftId = newDraft.id;
        }

        await OrderStorage.addItemToDraft(draftId, cartItem);

        this.close();
        await Cart.updateBadge();

        // Refresh order page jika sedang terbuka
        const orderPage = document.getElementById("pageOrders");
        if (orderPage && orderPage.style.display !== "none") {
            await OrderPage.refresh();
        }
    },

    close() {
        const modal = document.getElementById("cartModal");
        if (modal) modal.style.display = "none";
        this._product = null;
        this._draftId = null;
    }

};

// ==========================================
// ORDER PAGE — Draft list + history
// ==========================================

const OrderPage = {

    _activeDraftId: null,

    async init() {
        const container = document.getElementById("pageOrders");
        if (!container) return;

        container.innerHTML = this._renderShell();
        await OrderStorage.cleanOldHistory();
        await this.refresh();
    },

    _renderShell() {
        return `
            <div class="page-wrap">

                <div class="page-header">
                    <h2 class="page-title">Order</h2>
                    <button id="btnNewDraft" class="btn-primary">+ Draft Baru</button>
                </div>

                <!-- Form draft baru (tersembunyi) -->
                <div id="newDraftForm" class="inline-form-wrap" style="display:none">
                    <div class="inline-form">
                        <h4 class="inline-form-title">Buat Draft Baru</h4>
                        <div class="form-group">
                            <label>Nama Customer / Toko</label>
                            <input type="text" id="newDraftCustomer"
                                placeholder="Contoh: Toko Makmur" class="form-input">
                        </div>
                        <div class="inline-form-actions">
                            <button id="btnNewDraftCancel" class="btn-secondary">Batal</button>
                            <button id="btnNewDraftSave" class="btn-primary">Buat Draft</button>
                        </div>
                    </div>
                </div>

                <!-- List draft aktif -->
                <div id="draftListWrap"></div>

                <!-- Detail draft yang dipilih -->
                <div id="draftDetailWrap" style="display:none"></div>

                <!-- History -->
                <div id="orderHistoryWrap"></div>

            </div>
        `;
    },

    async refresh() {
        this._bindShellEvents();
        await this._renderDraftList();
        await this._renderHistory();
        await Cart.updateBadge();
    },

    _bindShellEvents() {
        document.getElementById("btnNewDraft")
            ?.addEventListener("click", () => this._toggleNewDraftForm(true));

        document.getElementById("btnNewDraftCancel")
            ?.addEventListener("click", () => this._toggleNewDraftForm(false));

        document.getElementById("btnNewDraftSave")
            ?.addEventListener("click", () => this._createNewDraft());
    },

    _toggleNewDraftForm(show) {
        const form = document.getElementById("newDraftForm");
        if (form) form.style.display = show ? "block" : "none";
        if (show) {
            document.getElementById("newDraftCustomer")?.focus();
        } else {
            const el = document.getElementById("newDraftCustomer");
            if (el) el.value = "";
        }
    },

    async _createNewDraft() {
        const name = document.getElementById("newDraftCustomer")?.value.trim();
        if (!name) { alert("Nama toko wajib diisi."); return; }

        await OrderStorage.createDraft(name);
        this._toggleNewDraftForm(false);
        await this.refresh();
    },

    async _renderDraftList() {
        const wrap = document.getElementById("draftListWrap");
        if (!wrap) return;

        const drafts = await OrderStorage.getAllDrafts();

        if (drafts.length === 0) {
            wrap.innerHTML = `
                <div class="order-empty">
                    <p>Belum ada draft order.</p>
                    <p style="font-size:13px;color:#94A3B8">
                        Klik "+ Draft Baru" untuk memulai, lalu tambah produk dari halaman Produk.
                    </p>
                </div>`;
            return;
        }

        wrap.innerHTML = `
            <h3 class="section-title">Draft Order (${drafts.length})</h3>
            <div class="draft-list">
                ${drafts.map(d => this._renderDraftCard(d)).join("")}
            </div>`;

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
            <div class="draft-card" id="draftCard_${draft.id}">
                <div class="draft-card-info">
                    <p class="draft-card-customer">${draft.customer}</p>
                    <p class="draft-card-meta">
                        ${draft.items.length} item · Diubah ${date}
                    </p>
                </div>
                <div class="draft-card-actions">
                    <button id="btnOpenDraft_${draft.id}" class="btn-primary btn-sm">
                        Lihat / Edit
                    </button>
                    <button id="btnDeleteDraft_${draft.id}" class="btn-secondary btn-sm btn-danger">
                        Hapus
                    </button>
                </div>
            </div>
        `;
    },

    async _openDraft(draftId) {
        this._activeDraftId = draftId;

        const draft = await OrderStorage.getDraft(draftId);
        if (!draft) return;

        // Cek perubahan harga
        const priceWarnings = this._checkPriceChanges(draft.items);

        const detailWrap = document.getElementById("draftDetailWrap");
        if (!detailWrap) return;

        detailWrap.style.display = "block";
        detailWrap.innerHTML = this._renderDraftDetail(draft, priceWarnings);

        // Scroll ke detail
        detailWrap.scrollIntoView({ behavior: "smooth", block: "start" });

        this._bindDraftDetailEvents(draft);
    },

    _checkPriceChanges(items) {
        const warnings = {};
        items.forEach(item => {
            const current = window._catalogProducts?.[item.kode]?.varianData?.[0];
            if (!current) return;
            const currentPrice = current.harga;
            if (
                currentPrice !== undefined &&
                currentPrice !== null &&
                Number(currentPrice) !== Number(item.harga)
            ) {
                warnings[item.kode] = {
                    oldPrice: item.harga,
                    newPrice: currentPrice
                };
            }
        });
        return warnings;
    },

    _renderDraftDetail(draft, priceWarnings) {
        const hasWarnings = Object.keys(priceWarnings).length > 0;

        return `
            <div class="draft-detail">

                <div class="draft-detail-header">
                    <div>
                        <h3 class="draft-detail-title">${draft.customer}</h3>
                        <p class="draft-detail-meta">${draft.items.length} item dalam draft</p>
                    </div>
                    <button id="btnCloseDraft" class="btn-secondary btn-sm">✕ Tutup</button>
                </div>

                ${hasWarnings ? `
                    <div class="price-warning-banner">
                        ⚠️ Ada ${Object.keys(priceWarnings).length} item dengan perubahan harga.
                        Periksa sebelum kirim order.
                    </div>
                ` : ""}

                <!-- Items -->
                <div class="draft-items">
                    ${draft.items.length === 0
                        ? `<p class="table-empty">Belum ada item. Tambah dari halaman Produk.</p>`
                        : draft.items.map(item => this._renderDraftItem(item, priceWarnings[item.kode])).join("")
                    }
                </div>

                <!-- Form kirim -->
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
    },

    _renderDraftItem(item, priceWarn) {
        const qty = this._formatQty(item);

        const priceWarnHtml = priceWarn ? `
            <div class="price-warn-badge">
                ⚠️ Harga berubah:
                Rp ${Number(priceWarn.oldPrice).toLocaleString("id-ID")}
                → Rp ${Number(priceWarn.newPrice).toLocaleString("id-ID")}
            </div>
        ` : "";

        return `
            <div class="draft-item">
                <img src="${item.image}" alt="" class="draft-item-img"
                    onerror="this.style.display='none'">
                <div class="draft-item-info">
                    <p class="draft-item-name">
                        ${item.nama_item}
                        ${item.varian && item.varian !== "-"
                            ? `<span class="cart-item-varian">— ${item.varian}</span>`
                            : ""}
                    </p>
                    <p class="draft-item-qty">${qty}</p>
                    ${item.harga
                        ? `<p class="draft-item-price ${priceWarn ? "price-changed" : ""}">
                            Rp ${Number(item.harga).toLocaleString("id-ID")}
                            / ${item.hargaType || item.satuan || ""}
                           </p>`
                        : ""}
                    ${item.note ? `<p class="cart-item-note">📝 ${item.note}</p>` : ""}
                    ${priceWarnHtml}
                </div>
                <button class="btn-remove-cart"
                    data-kode="${item.kode}"
                    id="btnRemoveItem_${item.kode}">✕</button>
            </div>
        `;
    },

    _bindDraftDetailEvents(draft) {
        document.getElementById("btnCloseDraft")
            ?.addEventListener("click", () => {
                document.getElementById("draftDetailWrap").style.display = "none";
                this._activeDraftId = null;
            });

        document.querySelectorAll("[id^='btnRemoveItem_']").forEach(btn => {
            btn.addEventListener("click", async () => {
                await OrderStorage.removeItemFromDraft(draft.id, btn.dataset.kode);
                await this._openDraft(draft.id);
                await this._renderDraftList();
                await Cart.updateBadge();
            });
        });

        document.getElementById("btnSendDraft")
            ?.addEventListener("click", () => this._sendDraft(draft.id));
    },

    async _sendDraft(draftId) {
        const draft = await OrderStorage.getDraft(draftId);
        if (!draft || draft.items.length === 0) return;

        // Simpan global note terbaru
        const note = document.getElementById("draftGlobalNote")?.value.trim() || "";
        draft.globalNote = note;
        await OrderStorage.saveDraft(draft);

        // Cek perubahan harga sebelum kirim
        const warnings = this._checkPriceChanges(draft.items);
        if (Object.keys(warnings).length > 0) {
            const lanjut = confirm(
                `⚠️ Ada ${Object.keys(warnings).length} item dengan perubahan harga.\n\n` +
                "Apakah Anda tetap ingin mengirim order dengan harga yang tersimpan di draft?"
            );
            if (!lanjut) return;
        }

        const btn = document.getElementById("btnSendDraft");
        if (btn) { btn.disabled = true; btn.textContent = "Mengirim..."; }

        try {

            const result = await API.createOrder({
                customer:    draft.customer,
                globalNote:  draft.globalNote,
                items:       draft.items
            });

            if (result.status !== "success") {
                throw new Error(result.message);
            }

            // Pindah ke history lalu hapus draft
            await OrderStorage.saveHistory(draft);
            await OrderStorage.deleteDraft(draftId);

            alert(`✓ Order untuk ${draft.customer} berhasil dikirim!`);

            document.getElementById("draftDetailWrap").style.display = "none";
            this._activeDraftId = null;

            await this.refresh();

        } catch (err) {
            alert(`❌ ${err.message}`);
            if (btn) { btn.disabled = false; btn.textContent = `Kirim Order ke ${draft.customer}`; }
        }
    },

    async _deleteDraft(draftId) {
        const draft = await OrderStorage.getDraft(draftId);
        if (!draft) return;

        if (!confirm(`Hapus draft "${draft.customer}"? Semua item akan hilang.`)) return;

        await OrderStorage.deleteDraft(draftId);

        if (this._activeDraftId === draftId) {
            document.getElementById("draftDetailWrap").style.display = "none";
            this._activeDraftId = null;
        }

        await this.refresh();
    },

    async _renderHistory() {
        const wrap = document.getElementById("orderHistoryWrap");
        if (!wrap) return;

        const history = await OrderStorage.getAllHistory();

        if (history.length === 0) {
            wrap.innerHTML = "";
            return;
        }

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
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    },

    _formatQty(item) {
        const parts = [];
        if ((item.carton || 0) > 0) parts.push(`${item.carton} Carton`);
        if ((item.inner  || 0) > 0) parts.push(`${item.inner} Inner`);
        if ((item.pack   || 0) > 0) parts.push(`${item.pack} Pack`);
        if ((item.pcs    || 0) > 0) parts.push(`${item.pcs} Pcs`);
        return parts.length > 0 ? parts.join(" · ") : "-";
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
