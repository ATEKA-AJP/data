document.addEventListener(
    "DOMContentLoaded",
    initApp
);

async function initApp() {

    await Database.open();

    // Inisialisasi navbar — handle menu visibility,
    // login/logout button, dan page switching
    await Navbar.init();

    LoginModal.bindEvents();

    // Tampilkan catalog sebagai halaman awal
    await loadCatalog();

}
