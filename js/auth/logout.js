/**
 * ==========================================
 * Logout
 * ==========================================
 */

const Logout = {

    async logout() {

        await SessionStorage.logout();

        return true;

    }

};