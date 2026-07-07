/**
 * ==========================================
 * AJP WEB CATALOG - Product Card Component
 * ==========================================
 *
 * Variant rules:
 * - 1 card per kode (main product code)
 * - Pills = dari kolom Varian, kode = variant_kode
 * - Kalau kode == variant_kode ATAU varian kosong/"-" → tidak ada variant
 * - Klik pill → ganti gambar (dari image per varianData), harga, stock
 * - Stock tersembunyi untuk public (tidak login)
 * - Satuan/inner/carton tampil sebagai spec-like rows
 */

// State: variant aktif per produk
window._activeVariant = {};

/**
 * Build packaging info HTML — format: "Inner X · Carton Y · satuan"
 * Dipanggil saat render awal dan saat switchVariant
 */
function _buildPackHTML(v) {
    const parts = [];
    if (v.inner  && v.inner  !== "-" && String(v.inner)  !== "0")
        parts.push(`Inner ${v.inner}`);
    if (v.carton && v.carton !== "-" && String(v.carton) !== "0")
        parts.push(`Carton ${v.carton}`);
    if (v.isi_per_pack && v.isi_per_pack !== "-")
        parts.push(`Pack ${v.isi_per_pack}`);
    if (v.satuan && v.satuan !== "-")
        parts.push(v.satuan);

    if (parts.length === 0) return "";

    return `
        <div class="spec-item">
            <span class="spec-key">Packaging</span>
            <span class="spec-val">${parts.join(" · ")}</span>
        </div>
    `;
}

function createProductCard(product, priceArea) {

    const kode  = product.kode;
    const vData = product.varianData;

    // Set default active variant
    if (window._activeVariant[kode] === undefined) {
        window._activeVariant[kode] = 0;
    }

    const idx = window._activeVariant[kode];
    const v   = vData[idx] || vData[0];

    // Tentukan apakah product punya variant nyata
    // Rule: hasVariant true kalau lebih dari 1 varianData
    //       ATAU kode != variant_kode
    //       DAN varian tidak kosong/"-"
    const hasRealVariants = vData.length > 1 ||
        (vData.length === 1 &&
         vData[0].variant_kode !== kode &&
         vData[0].varian &&
         vData[0].varian !== "-");

    // ======================================================
    // IMAGE — dari varianData (variant_kode based)
    // ======================================================
    const imageUrl = v.image || product.image || "";

    // ======================================================
    // PILLS — hanya kalau ada real variants
    // ======================================================
    let pillsHTML = "";

    if (hasRealVariants && vData.length > 1) {
        pillsHTML = `
            <div class="variant-pills" id="pills_${kode}">
                ${vData.map((vd, i) => {
                    const label = vd.varian && vd.varian !== "-"
                        ? vd.varian
                        : vd.variant_kode;
                    return `
                        <button
                            class="pill ${i === idx ? "active" : ""}"
                            onclick="switchVariant('${kode}', ${i})"
                            data-variant-index="${i}">
                            ${label}
                        </button>`;
                }).join("")}
            </div>
        `;
    }

    // ======================================================
    // SPEC — max 3 visible, sisanya collapsed
    // ======================================================
    const specEntries = Object.entries(v.spec || {});
    const cardSpecId  = "spec_" + kode.replace(/[^a-z0-9]/gi, "_");

    let specHTML = "";

    if (specEntries.length > 0) {
        const visible = specEntries.slice(0, 3);
        const hidden  = specEntries.slice(3);

        const makeSpecItem = ([key, val], isHidden = false) => `
            <div class="spec-item ${isHidden ? "spec-item-hidden" : ""}">
                <span class="spec-key">${key}</span>
                <span class="spec-val">${val}</span>
            </div>`;

        specHTML = `
            <div class="product-spec-wrap">
                <div class="spec-list" id="${cardSpecId}">
                    ${visible.map(e => makeSpecItem(e, false)).join("")}
                    ${hidden.map(e => makeSpecItem(e, true)).join("")}
                </div>
                ${hidden.length > 0 ? `
                    <button class="spec-toggle-btn"
                            onclick="toggleSpec('${cardSpecId}', this)">
                        Lihat ${hidden.length} spesifikasi lainnya ▾
                    </button>` : ""}
            </div>
        `;
    }

    // ======================================================
    // PACKAGING — "Packaging: Inner X · Carton Y · satuan"
    // ======================================================
    const packContent = _buildPackHTML(v);
    const packHTML = packContent ? `
        <div class="spec-list pack-info" id="pack_${kode}">
            ${packContent}
        </div>` : `<div class="pack-info" id="pack_${kode}"></div>`;

    // ======================================================
    // HARGA — "Rp X / satuan"
    // ======================================================
    let priceHTML = "";

    if (v.harga !== undefined && v.harga !== null) {
        const finalPrice = Number(
            priceArea === "sumatra" && v.hargaSumatra
                ? v.hargaSumatra
                : v.harga
        );
        const satuanLabel = v.satuan ? v.satuan.toLowerCase() : "";

        priceHTML = `
            <span class="price-amount" id="price_${kode}">
                Rp ${finalPrice.toLocaleString("id-ID")}
            </span>
            ${satuanLabel
                ? `<span class="price-satuan" id="satuan_${kode}">
                    / ${satuanLabel}
                   </span>`
                : ""}
        `;
    }

    // ======================================================
    // STOCK — hanya tampil kalau user login
    // Ditentukan oleh class "has-price" pada grid
    // Kita pakai data attribute, JS akan hide/show
    // ======================================================
    const stock      = v.stock ?? 0;
    const stockClass = stock > 0 ? "stock-ok" : "stock-empty";

    return `
        <div class="product-card"
             data-kode="${kode}"
             data-variants='${JSON.stringify(vData.map(vd => ({
                 variant_kode: vd.variant_kode,
                 varian:       vd.varian,
                 image:        vd.image || product.image || "",
                 harga:        vd.harga,
                 hargaSumatra: vd.hargaSumatra,
                 satuan:       vd.satuan,
                 isi_per_pack: vd.isi_per_pack,
                 inner:        vd.inner,
                 carton:       vd.carton,
                 stock:        vd.stock,
                 spec:         vd.spec
             })))}'>

            ${product.new ? `<span class="badge-new">NEW</span>` : ""}

            <div class="product-image">
                <img id="img_${kode}" src="${imageUrl}"
                     alt="${product.nama_item}" loading="lazy"
                     onerror="this.src=''">
            </div>

            <h3>${product.nama_item}</h3>

            ${specHTML}

            ${packHTML}

            ${pillsHTML}

            <div class="price-stock">
                <div class="price">${priceHTML}</div>
                <div class="stock ${stockClass} card-stock" id="stock_${kode}">
                    Stock: <strong>${stock}</strong>
                </div>
            </div>

            <button class="add-cart-btn" data-kode="${kode}">
                Tambah Order
            </button>

        </div>
    `;
}

/**
 * Ganti variant aktif pada satu card
 * Dipanggil dari onclick pill
 */
function switchVariant(kode, idx) {

    window._activeVariant[kode] = idx;

    const card = document.querySelector(`.product-card[data-kode="${kode}"]`);
    if (!card) return;

    let variants;
    try {
        variants = JSON.parse(card.dataset.variants);
    } catch { return; }

    const v = variants[idx];
    if (!v) return;

    // Ganti gambar
    const img = document.getElementById("img_" + kode);
    if (img && v.image) img.src = v.image;

    // Ganti harga
    const priceEl  = document.getElementById("price_" + kode);
    const satuanEl = document.getElementById("satuan_" + kode);

    if (priceEl && v.harga !== undefined && v.harga !== null) {
        priceEl.textContent = "Rp " + Number(v.harga).toLocaleString("id-ID");
    }
    if (satuanEl && v.satuan) {
        satuanEl.textContent = "/ " + v.satuan.toLowerCase();
    }

    // Ganti stock
    const stockEl = document.getElementById("stock_" + kode);
    if (stockEl) {
        const stock = v.stock ?? 0;
        stockEl.textContent = "Stock: " + stock;
        stockEl.className   = "stock card-stock " +
            (stock > 0 ? "stock-ok" : "stock-empty");
    }

    // Ganti pack info
    const packEl = document.getElementById("pack_" + kode);
    if (packEl) {
        packEl.innerHTML = _buildPackHTML(v);
    }

    // Ganti spec — preserve expand/collapse state
    const specId   = "spec_" + kode.replace(/[^a-z0-9]/gi, "_");
    const specEl   = document.getElementById(specId);
    const specWrap = specEl?.closest(".product-spec-wrap");
    const toggleBtn = specWrap?.querySelector(".spec-toggle-btn");

    // Baca state sebelum update
    const wasOpen = toggleBtn?.dataset.open === "true";

    if (specEl && v.spec) {
        const entries = Object.entries(v.spec);
        const visible = entries.slice(0, 3);
        const hidden  = entries.slice(3);
        const makeItem = ([key, val], isHidden) => `
            <div class="spec-item${isHidden ? " spec-item-hidden" : ""}">
                <span class="spec-key">${key}</span>
                <span class="spec-val">${val}</span>
            </div>`;

        specEl.innerHTML =
            visible.map(e => makeItem(e, false)).join("") +
            hidden.map(e => makeItem(e, true)).join("");

        // Restore state yang sama
        const hiddenItems = specEl.querySelectorAll(".spec-item-hidden");

        if (hidden.length > 0 && toggleBtn) {
            hiddenItems.forEach(item => {
                // Kalau sebelumnya open → tampilkan, kalau closed → sembunyikan
                item.style.display = wasOpen ? "contents" : "none";
            });
            toggleBtn.dataset.open  = wasOpen ? "true" : "false";
            toggleBtn.textContent   = wasOpen
                ? "Sembunyikan ▴"
                : `Lihat ${hidden.length} spesifikasi lainnya ▾`;
            toggleBtn.style.display = "";
        } else if (toggleBtn) {
            // Variant baru tidak punya hidden spec → sembunyikan tombol toggle
            toggleBtn.style.display = "none";
        }
    }

    // Update active pill
    const pillsWrap = document.getElementById("pills_" + kode);
    if (pillsWrap) {
        pillsWrap.querySelectorAll(".pill").forEach((btn, i) => {
            btn.classList.toggle("active", i === idx);
        });
    }
}

/**
 * Toggle spec expand/collapse
 */
function toggleSpec(listId, btn) {
    const list        = document.getElementById(listId);
    if (!list) return;

    const hiddenItems = list.querySelectorAll(".spec-item-hidden");
    const count       = hiddenItems.length;
    const isOpen      = btn.dataset.open === "true";

    hiddenItems.forEach(item => {
        item.style.display = isOpen ? "none" : "contents";
    });

    btn.dataset.open = isOpen ? "false" : "true";
    btn.textContent  = isOpen
        ? `Lihat ${count} spesifikasi lainnya ▾`
        : "Sembunyikan ▴";
}

/**
 * Sembunyikan/tampilkan stock berdasarkan status login
 * Dipanggil dari renderProducts setelah grid render
 */
function applyStockVisibility(isLoggedIn) {
    document.querySelectorAll(".card-stock").forEach(el => {
        el.style.display = isLoggedIn ? "" : "none";
    });
}
