/**
 * ==========================================
 * AJP WEB CATALOG
 * Authentication Session Bridge
 * ==========================================
 */

const Session = {
    /**
     * Mengambil data user yang sedang login saat ini
     */
    async getCurrentUser() {
        try {
            // Memanggil SessionStorage (IndexedDB) yang menyimpan profile user
            return await SessionStorage.load();
        } catch (error) {
            console.error("Session Bridge Error:", error);
            return null;
        }
    },

    /**
     * Memeriksa apakah ada user yang sedang login atau tidak
     */
    async isLoggedIn() {
        const user = await this.getCurrentUser();
        return user !== null && !!user.email;
    }
};