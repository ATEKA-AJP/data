/**
 * ==========================================
 * AJP WEB CATALOG - Mapping Page
 * ==========================================
 * Supervisor dapat:
 * - Lihat daftar mapping supplier kode → variant kode
 * - Search by supplier kode atau variant kode
 * - Tambah mapping baru via form inline
 */

const MappingPage = {

    _searchTimer: null,

    async init() {

        const container =
            document.getElementById("pageMapping");

        if (!container) return;

        container.innerHTML = this._renderHTML();

        this._bindEvents();
        await this._load();

    },

    _renderHTML() {

        return `
            <div class="page-wrap">

                <div class="page-header">
                    <h2 class="page-title">Mapping</h2>
                    <button id="btnAddMapping" class="btn-primary">+ Tambah Mapping</button>
                </div>

                <!-- Form Tambah Mapping (tersembunyi default) -->
                <div id="mappingFormWrap" class="inline-form-wrap" style="display:none">
                    <div class="inline-form">

                        <h4 class="inline-form-title">Mapping Baru</h4>

                        <div class="inline-form-row">
                            <div class="form-group">
                                <label>Supplier Kode</label>
                                <input
                                    type="text"
                                    id="mappingSupplierKode"
                                    placeholder="Contoh: ABC001"
                                    class="form-input">
                            </div>
                            <div class="form-group">
                                <label>Variant Kode (MASTER)</label>
                                <input
                                    type="text"
                                    id="mappingVariantKode"
                                    placeholder="Contoh: BP-GP10-RED"
                                    class="form-input">
                            </div>
                        </div>

                        <div class="inline-form-actions">
                            <button id="btnMappingCancel" class="btn-secondary">Batal</button>
                            <button id="btnMappingSave" class="btn-primary">Simpan</button>
                        </div>

                    </div>
                </div>

                <div class="table-toolbar">
                    <div class="search-input-wrap">
                        <input
                            type="text"
                            id="mappingSearch"
                            placeholder="Search supplier kode / variant kode..."
                            class="table-search">
                    </div>
                </div>

                <div id="mappingTableWrap" class="table-wrap">
                    <p class="table-loading">Memuat data...</p>
                </div>

            </div>
        `;

    },

    _bindEvents() {

        document
            .getElementById("btnAddMapping")
            ?.addEventListener("click", () => {
                this._toggleForm(true);
            });

        document
            .getElementById("btnMappingCancel")
            ?.addEventListener("click", () => {
                this._toggleForm(false);
            });

        document
            .getElementById("btnMappingSave")
            ?.addEventListener("click", () => {
                this._doSave();
            });

        document
            .getElementById("mappingSearch")
            ?.addEventListener("input", () => {
                clearTimeout(this._searchTimer);
                this._searchTimer = setTimeout(() => {
                    this._load();
                }, 400);
            });

    },

    async _load() {

        const wrap =
            document.getElementById("mappingTableWrap");

        wrap.innerHTML =
            `<p class="table-loading">Memuat data...</p>`;

        try {

            const q =
                document.getElementById("mappingSearch")
                    ?.value.trim() || "";

            const result = await API.getMapping(q);

            if (result.status !== "success") {
                throw new Error(result.message);
            }

            this._renderTable(result.data, result.total);

        } catch (err) {

            wrap.innerHTML =
                `<p class="table-error">❌ ${err.message}</p>`;

        }

    },

    _renderTable(rows, total) {

        const wrap =
            document.getElementById("mappingTableWrap");

        if (!rows || rows.length === 0) {
            wrap.innerHTML =
                `<p class="table-empty">Belum ada data mapping.</p>`;
            return;
        }

        wrap.innerHTML = `
            <p class="table-count">
                Menampilkan ${rows.length.toLocaleString("id-ID")}
                ${total !== rows.length
                    ? ` dari ${total.toLocaleString("id-ID")}`
                    : ""}
                mapping
            </p>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Supplier Kode</th>
                        <th>Variant Kode</th>
                        <th>Include</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(r => `
                        <tr>
                            <td class="td-mono">${r.supplierKode}</td>
                            <td class="td-mono">${r.variantKode}</td>
                            <td>
                                <span class="status-badge ${r.include ? "status-open" : "status-skip"}">
                                    ${r.include ? "Include" : "Exclude"}
                                </span>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;

    },

    _toggleForm(show) {

        const formWrap =
            document.getElementById("mappingFormWrap");

        formWrap.style.display = show ? "block" : "none";

        if (show) {
            document.getElementById("mappingSupplierKode")?.focus();
        } else {
            document.getElementById("mappingSupplierKode").value = "";
            document.getElementById("mappingVariantKode").value  = "";
        }

    },

    async _doSave() {

        const supplierKode =
            document.getElementById("mappingSupplierKode")
                ?.value.trim().toUpperCase();

        const variantKode =
            document.getElementById("mappingVariantKode")
                ?.value.trim();

        if (!supplierKode) {
            alert("Supplier Kode wajib diisi.");
            return;
        }

        if (!variantKode) {
            alert("Variant Kode wajib diisi.");
            return;
        }

        const btn =
            document.getElementById("btnMappingSave");

        btn.disabled    = true;
        btn.textContent = "Menyimpan...";

        try {

            const result =
                await API.saveMapping(supplierKode, variantKode);

            if (result.status !== "success") {
                throw new Error(result.message);
            }

            alert(`✓ ${result.message}`);
            this._toggleForm(false);
            await this._load();

        } catch (err) {

            alert(`❌ ${err.message}`);

        } finally {

            btn.disabled    = false;
            btn.textContent = "Simpan";

        }

    }

};

function loadMapping() {
    MappingPage.init();
}
