/**
 * ==========================================
 * AJP WEB CATALOG - Navbar
 * ==========================================
 * CATATAN: roleMenu.css pakai display:flex !important dan
 * display:inline-flex !important pada semua <a> child.
 * Karena itu kita TIDAK bisa pakai inline style untuk hide.
 * Solusi: pakai class .hidden-menu { display:none !important }
 * yang sudah ada di roleMenu.css.
 */

const Navbar = {

    _menuPermissions: {
        menuProducts: null,
        menuOrders:   "order.view",
        menuUpload:   "stock.import",
        menuUnmapped: "mapping.edit",
        menuMapping:  "mapping.edit",
        menuUsers:    "user.manage"
    },

    _menuPages: {
        menuProducts: "pageCatalog",
        menuOrders:   "pageOrders",
        menuUpload:   "pageUpload",
        menuUnmapped: "pageUnmapped",
        menuMapping:  "pageMapping",
        menuUsers:    "pageUsers"
    },

    async init() {

        const user = await Session.getCurrentUser();

        this._applyPermissions(user);
        this._updateLoginButton(user);
        this._bindMenuEvents();

    },

    _hide(el) {
        if (el) el.classList.add("hidden-menu");
    },

    _show(el) {
        if (el) el.classList.remove("hidden-menu");
    },

    _applyPermissions(user) {

        const roleMenu = document.getElementById("roleMenu");

        // Public: sembunyikan seluruh nav
        if (!user) {
            this._hide(roleMenu);
            return;
        }

        // Login: tampilkan nav
        this._show(roleMenu);

        const perms = Array.isArray(user.permissions)
            ? user.permissions
            : [];

        // Debug: buka DevTools > Console untuk cek role & permissions
        console.log("[Navbar] role:", user.role, "| permissions:", perms);

        Object.entries(this._menuPermissions).forEach(([menuId, permission]) => {

            const el = document.getElementById(menuId);

            if (!el) return;

            const canSee = permission === null || perms.includes(permission);

            if (canSee) {
                this._show(el);
            } else {
                this._hide(el);
            }

        });

    },

    _updateLoginButton(user) {

        const btn = document.getElementById("loginButton");
        if (!btn) return;

        if (user) {

            const inisial = user.nama
                ? user.nama.charAt(0).toUpperCase()
                : "?";

            btn.innerHTML =
                `<span class="avatar-initial">${inisial}</span>`;

            btn.title = `${user.nama} — klik untuk logout`;

            btn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`Logout dari akun ${user.nama}?`)) {
                    await Auth.logout();
                    window.location.reload();
                }
            };

        } else {

            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg"
                     viewBox="0 0 24 24" fill="currentColor"
                     style="width:20px;height:20px;">
                    <path fill-rule="evenodd"
                          d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25
                             8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1
                             12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
                          clip-rule="evenodd"/>
                </svg>`;

            btn.title   = "Login";
            btn.onclick = () => LoginModal.open();

        }

    },

    _bindMenuEvents() {

        Object.entries(this._menuPages).forEach(([menuId]) => {

            const el = document.getElementById(menuId);
            if (!el) return;

            el.addEventListener("click", (e) => {
                e.preventDefault();
                this.switchPage(menuId);
            });

        });

    },

    switchPage(activeMenuId) {

        // Reset active class semua menu
        Object.keys(this._menuPages).forEach(menuId => {
            document.getElementById(menuId)?.classList.remove("active");
        });

        // Sembunyikan semua page container
        Object.values(this._menuPages).forEach(pageId => {
            const page = document.getElementById(pageId);
            if (page) page.style.display = "none";
        });

        // Aktifkan menu yang dipilih
        document.getElementById(activeMenuId)?.classList.add("active");

        // Tampilkan page yang sesuai
        const targetPage = document.getElementById(
            this._menuPages[activeMenuId]
        );
        if (targetPage) targetPage.style.display = "";

        this._onPageLoad(activeMenuId);

    },

    _onPageLoad(menuId) {

        switch (menuId) {
            case "menuProducts":
                if (typeof loadCatalog   === "function") loadCatalog();   break;
            case "menuOrders":
                if (typeof loadOrders    === "function") loadOrders();    break;
            case "menuUpload":
                if (typeof loadUpload    === "function") loadUpload();    break;
            case "menuUnmapped":
                if (typeof loadUnmapped  === "function") loadUnmapped();  break;
            case "menuMapping":
                if (typeof loadMapping   === "function") loadMapping();   break;
            case "menuUsers":
                if (typeof loadUsers     === "function") loadUsers();     break;
        }

    }

};
