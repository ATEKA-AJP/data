/**
 * ==========================================
 * AJP WEB CATALOG - Catalog Page
 * ==========================================
 */

// Simpan produk di memory untuk diakses CartModal
// saat user klik "Tambah Order"
window._catalogProducts = {};

async function loadCatalog() {

    try {

        const [currentUser, initialResult] = await Promise.all([
            Session.getCurrentUser(),
            API.getProducts({})
        ]);

        let result = initialResult;

        if (currentUser && currentUser.email) {
            result = await API.getProducts({
                priceArea: currentUser.priceArea || "regular"
            });
        }

        if (result && result.products) {
            renderProducts(result.products, result.priceArea || "regular");
        } else {
            renderProducts([], "regular");
        }

        // Update cart badge setelah catalog load
        if (typeof Cart !== "undefined") {
            await Cart.updateBadge();
        }

    } catch (error) {

        console.error("Gagal memuat katalog produk:", error);

        const grid = document.getElementById("productGrid");

        if (grid) {
            grid.innerHTML = `
                <div style='grid-column:1/-1;text-align:center;color:#EF4444;padding:40px'>
                    Gagal memuat produk: ${error.message}
                </div>`;
        }

    }

}

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

    // Simpan di memory agar CartModal bisa lookup by kode
    window._catalogProducts = {};

    products.forEach(p => {
        window._catalogProducts[p.kode] = p;
    });

    grid.innerHTML = products
        .map(product => createProductCard(product, priceArea))
        .join("");

    // Wire up tombol "Tambah Order" — hanya untuk user yang sudah login
    grid.querySelectorAll(".add-cart-btn").forEach(btn => {
        btn.addEventListener("click", async () => {

            const user = await Session.getCurrentUser();

            if (!user) {
                LoginModal.open();
                return;
            }

            const kode    = btn.dataset.kode;
            const product = window._catalogProducts[kode];

            if (product && typeof openCartModal === "function") {
                openCartModal(product);
            }

        });
    });

}
