/**
 * ==========================================
 * AJP WEB CATALOG - Catalog Page
 * ==========================================
 */

window._catalogProducts = {};

// State
let _currentPage  = 1;
let _currentQuery = "";
let _searchTimer  = null;

async function loadCatalog(query = "", page = 1) {

    _currentQuery = query;
    _currentPage  = page;

    const grid = document.getElementById("productGrid");

    try {
        const currentUser = await Session.getCurrentUser();

        // Cek cache hanya untuk full catalog (tanpa query, page 1)
        if (!query && page === 1) {
            const fresh = await CatalogStorage.isFresh(currentUser);
            if (fresh) {
                const cached = await CatalogStorage.load(currentUser);
                if (cached && cached.products) {
                    renderProducts(cached.products, cached.priceArea || "regular");
                    _renderPagination(cached.pagination);
                    _fetchAndUpdate(currentUser, query, page);
                    return;
                }
            }
        }

        if (grid) {
            grid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;color:#94A3B8;padding:40px">
                    Memuat produk...
                </div>`;
        }

        await _fetchAndUpdate(currentUser, query, page);

    } catch (err) {
        console.error("Gagal memuat katalog:", err);
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;color:#EF4444;padding:40px">
                    Gagal memuat produk: ${err.message}
                </div>`;
        }
    }
}

async function _fetchAndUpdate(currentUser, query, page) {

    try {
        const params = { page };

        if (query)  params.q        = query;
        if (currentUser?.email) {
            params.priceArea = _getActivePriceArea(currentUser);
        }

        const result = await API.getProducts(params);

        if (result && result.products) {
            renderProducts(result.products, params.priceArea || "regular");
            _renderPagination(result.pagination);

            if (!query && page === 1) {
                await CatalogStorage.save(currentUser, result);
            }
        } else {
            renderProducts([], "regular");
            _renderPagination(null);
        }

        if (typeof Cart !== "undefined") await Cart.updateBadge();

    } catch (err) {
        console.error("Fetch gagal:", err);
        const grid = document.getElementById("productGrid");
        if (grid?.innerHTML.includes("Memuat produk")) {
            grid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;color:#EF4444;padding:40px">
                    Gagal memuat produk: ${err.message}
                </div>`;
        }
        _renderPagination(null);
    }

}

// ==========================================
// _PRICE_AREA_KEY, _getActivePriceArea, _setPriceArea
// sudah dideklarasikan di navbar.js (load lebih awal)

function _applySumatraTint(isSumatra) {
    const grid = document.getElementById("productGrid");
    if (!grid) return;
    grid.classList.toggle("price-area-sumatra", isSumatra);
}

// ==========================================
// PAGINATION
// ==========================================

function _renderPagination(pagination) {
    let wrap = document.getElementById("catalogPagination");

    if (!wrap) {
        wrap = document.createElement("div");
        wrap.id = "catalogPagination";
        wrap.style.cssText = "margin: 24px 0;";

        const grid = document.getElementById("productGrid");
        if (grid?.parentNode) {
            grid.parentNode.insertBefore(wrap, grid.nextSibling);
        }
    }

    if (!pagination || pagination.totalPages <= 1) {
        wrap.innerHTML = "";
        return;
    }

    const { page, totalPages, total } = pagination;

    const pageNumbers = _buildPageNumbers(page, totalPages);

    wrap.innerHTML = `
        <div class="pagination">
            <span class="pagination-info">
                Total ${total.toLocaleString("id-ID")} produk
            </span>
            <div class="pagination-btns">
                <button class="pg-btn" data-page="${page - 1}"
                    ${page <= 1 ? "disabled" : ""}>‹ Sebelumnya</button>
                ${pageNumbers.map(p =>
                    p === "..."
                        ? `<span class="pg-ellipsis">…</span>`
                        : `<button class="pg-btn ${p === page ? "active" : ""}"
                                data-page="${p}">${p}</button>`
                ).join("")}
                <button class="pg-btn" data-page="${page + 1}"
                    ${page >= totalPages ? "disabled" : ""}>Berikutnya ›</button>
            </div>
        </div>
    `;

    wrap.querySelectorAll(".pg-btn:not([disabled])").forEach(btn => {
        btn.addEventListener("click", () => {
            loadCatalog(_currentQuery, Number(btn.dataset.page));
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });
}

function _buildPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [1];
    if (current > 3) pages.push("...");
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        pages.push(i);
    }
    if (current < total - 2) pages.push("...");
    pages.push(total);
    return pages;
}

// ==========================================
// SEARCH
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => {
            _currentPage = 1;
            loadCatalog(searchInput.value.trim(), 1);
        }, 400);
    });

    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            clearTimeout(_searchTimer);
            _currentPage = 1;
            loadCatalog(searchInput.value.trim(), 1);
        }
    });
});

// ==========================================
// RENDER
// ==========================================

function renderProducts(products, priceArea) {

    const grid = document.getElementById("productGrid");
    if (!grid) return;

    _applySumatraTint(priceArea === "sumatra");

    if (!products || products.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;color:#6B7280;padding:40px">
                Tidak ada produk yang ditemukan.
            </div>`;
        return;
    }

    // Reset variant state untuk render baru
    window._activeVariant = {};
    window._catalogProducts = {};
    products.forEach(p => { window._catalogProducts[p.kode] = p; });

    grid.innerHTML = products
        .map(product => createProductCard(product, priceArea))
        .join("");

    // Terapkan stock visibility berdasarkan login status
    Session.getCurrentUser().then(user => {
        applyStockVisibility(!!user?.email);
    });

    // Wire "Tambah Order" buttons
    grid.querySelectorAll(".add-cart-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const user = await Session.getCurrentUser();
            if (!user) { LoginModal.open(); return; }
            const product = window._catalogProducts[btn.dataset.kode];
            if (product && typeof openCartModal === "function") {
                // Kirim product dengan variant yang sedang aktif
                const activeIdx = window._activeVariant[product.kode] || 0;
                openCartModal(product, activeIdx);
            }
        });
    });
}
