/**
 * ==========================================\
 * AJP WEB CATALOG
 * Core Database Config & Helpers (IndexedDB)
 * ==========================================\
 */

const Database = {
    db: null,

    /**
     * Membuka koneksi IndexedDB dan memastikan semua tabel terbuat otomatis
     */
    open() {
        return new Promise((resolve, reject) => {
            // Menggunakan versi 2 agar tabel baru terdeteksi
            const request = indexedDB.open(CONFIG.DB_NAME, 3);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 1. Tabel Produk
                if (!db.objectStoreNames.contains("products")) {
                    db.createObjectStore("products", { keyPath: "kode" });
                    console.log("IndexedDB: Tabel 'products' dibuat.");
                }

                // 2. Tabel Session Login
                if (!db.objectStoreNames.contains("session")) {
                    db.createObjectStore("session", { keyPath: "email" });
                    console.log("IndexedDB: Tabel 'session' dibuat.");
                }

                // 3. Tabel Keranjang Belanja (Cart)
                if (!db.objectStoreNames.contains("cart")) {
                    db.createObjectStore("cart", { keyPath: "kode" });
                }

                // 4. Draft order tersimpan
                if (!db.objectStoreNames.contains("drafts")) {
                    db.createObjectStore("drafts", { keyPath: "id" });
                }

                // 5. Riwayat order yang sudah dikirim
                if (!db.objectStoreNames.contains("orderHistory")) {
                    db.createObjectStore("orderHistory", { keyPath: "id" });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("IndexedDB: Koneksi database AJP berhasil.");
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error("IndexedDB Error:", event.target.error);
                reject(event.target.error);
            };
        });
    },

    /**
     * FUNGSI AMBIL DATA (Suntikan Perbaikan Eror)
     * Mengambil satu data berdasarkan key (ID/Kode) dari tabel tertentu
     */
    get(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("Database belum terbuka.");
            
            const transaction = this.db.transaction(storeName, "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * FUNGSI AMBIL SEMUA DATA
     * Mengambil seluruh isi data dari tabel tertentu
     */
    getAll(storeName) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("Database belum terbuka.");

            const transaction = this.db.transaction(storeName, "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * FUNGSI SIMPAN/UPDATE DATA
     * Memasukkan atau memperbarui data ke dalam tabel tertentu
     */
    put(storeName, data) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("Database belum terbuka.");

            const transaction = this.db.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * FUNGSI HAPUS DATA
     * Menghapus satu data dari tabel tertentu berdasarkan key
     */
    delete(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("Database belum terbuka.");

            const transaction = this.db.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * FUNGSI BERSIHKAN SATU TABEL FULL
     */
    clear(storeName) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("Database belum terbuka.");

            const transaction = this.db.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
};