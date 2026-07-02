/**
 * ==========================================
 * AJP WEB CATALOG - Catalog Page
 * ==========================================
 */

window._catalogProducts = {};

let _searchTimer = null;

async function loadCatalog(query = "") {

    try {

        const currentUser = await Session.getCurrentUser();

        const params = query ? { q: query } : {};

        if (currentUser && currentUser.email) {
            params.priceArea = currentUser.priceArea || "regular";
        }

        const result = await API.getProducts(params);

        if (result && result.products) {
            renderProducts(result.products, result.priceArea || "regular");
        } else {
            renderProducts([], "regular");
        }

        if (typeof Cart !== "undefined") {
            await Cart.updateBadge();
        }

    } catch (error) {

        console.error("Gagal memuat katalog:", error);

        const grid = document.getElementById("productGrid");
        if (grid) {
            grid.innerHTML = `
                <div style='grid-column:1/-1;text-align:center;color:#EF4444;padding:40px'>
                    Gagal memuat produk: ${error.message}
                </div>`;
        }

    }

}

// Wire up search input di header
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => {
            loadCatalog(searchInput.value.trim());
        }, 400);
    });

    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            clearTimeout(_searchTimer);
            loadCatalog(searchInput.value.trim());
        }
    });
});

function renderProducts(products, priceArea) {

    const grid = document.getElementById("productGrid");
    if (!grid) return;

    if (!products || products.length === 0) {
        grid.innerHTML = `
            <div style='grid-column:1/-1;text-align:center;color:#6B7280;padding:40px'>
                Tidak ada produk yang ditemukan.
            </div>`;
        return;
    }

    window._catalogProducts = {};
    products.forEach(p => { window._catalogProducts[p.kode] = p; });

    grid.innerHTML = products
        .map(product => createProductCard(product, priceArea))
        .join("");

    grid.querySelectorAll(".add-cart-btn").forEach(btn => {
        btn.addEventListener("click", async () => {

            const user = await Session.getCurrentUser();
            if (!user) { LoginModal.open(); return; }

            const product = window._catalogProducts[btn.dataset.kode];
            if (product && typeof openCartModal === "function") {
                openCartModal(product);
            }

        });
    });

}
