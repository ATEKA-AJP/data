/**
 * ==========================================\
 * AJP WEB CATALOG
 * Product Card Component (Master Sheet Column Match)
 * ==========================================\
 */

function createProductCard(product, priceArea) {
    // 1. Ambil data dari array varian pertama sesuai program asli Anda
    const variant = product.varianData[0];
    const stock = variant.stock ?? 0;
    const unit = variant.satuan ?? "";

    // 2. Gabungkan string spesifikasi produk (spec)
    const spec = Object.values(variant.spec || {}).join(" • ");

    // =======================================================
    // LOGIKA HARGA & TAG (HANYA BERISI JIKA BACKEND MENGIRIM DATA)
    // =======================================================
    let priceHTML = "";
    let stealthClass = "mode-alpha"; // Default Class untuk Regular

    // Kondisi ini otomatis terpenuhi saat Sales login (karena backend mengirim data harga)
    // Dan otomatis terlewati saat Publik (karena backend mengirim variant.harga sebagai undefined/null)
    if (variant.harga !== undefined && variant.harga !== null) {
        
        // Tentukan harga berdasarkan area (Regular atau Sumatra)
        let finalPrice = Number(variant.harga || 0); 
        if (priceArea === "sumatra" && variant.hargaSumatra) {
            finalPrice = Number(variant.hargaSumatra);
            stealthClass = "mode-beta"; // Ubah Class ke Sumatra (Stealth mode tanpa teks wilayah)
        }

        // Format angka ke Rupiah yang rapi (Contoh: Rp 150.000)
        const formattedPrice = finalPrice.toLocaleString("id-ID");

        // Ambil tipe harga (PPN / Netto) dari kolom 'hargaType' master sheet
        const typeTag = variant.hargaType ? variant.hargaType.toUpperCase() : "";
        const tagClass = typeTag === "NETTO" ? "tag-netto" : "tag-ppn";

        // Struktur HTML harga + Tag PPN/Netto yang langsung muncul setelah login
        priceHTML = `
            <div class="price-container">
                <span class="price-amount">Rp ${formattedPrice}</span>
                ${typeTag ? `<span class="badge-price-type ${tagClass}">${typeTag}</span>` : ""}
            </div>
        `;
    }

    // 3. Kembalikan seluruh struktur HTML asli Anda tanpa ada komponen visual yang hilang
    return `
        <div class="product-card ${variant.harga !== undefined ? stealthClass : ''}">
            <div class="badges">
                ${
                    product.new
                    ? `<span class="badge-new">NEW</span>`
                    : ""
                }
            </div>

            <div class="product-image">
                <img
                    src="${product.image}"
                    alt="${product.nama_item}"
                    loading="lazy">
            </div>

            <h3>
                ${product.nama_item}
            </h3>

            ${
                spec
                ? `
                    <div class="product-spec">
                        ${spec}
                    </div>
                `
                : ""
            }

            <div class="variant-pills">
                ${
                    product.hasVariant
                    ? `<button>Pilih Varian</button>`
                    : `<button class="active">${unit}</button>`
                }
            </div>

            <div class="price-stock">
                <div class="price">
                    ${priceHTML}
                </div>

                <div class="stock">
                    Stock: <strong>${stock}</strong>
                </div>
            </div>

            <button
                class="add-cart-btn"
                data-kode="${product.kode}">
                Tambah Order
            </button>
        </div>
    `;
}