/**
 * ==========================================
 * AJP WEB CATALOG - API Layer
 * ==========================================
 */

const API = {

    /**
     * Ambil token dari session untuk disertakan ke request
     * Token disimpan saat login dan dibutuhkan untuk semua POST endpoint
     */
    async getToken() {
        try {
            const user = await SessionStorage.load();
            return user ? (user.token || "") : "";
        } catch {
            return "";
        }
    },

    async get(action = "", params = {}) {
        const url = new URL(CONFIG.API_URL);

        if (action) {
            url.searchParams.append("action", action);
        }

        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Gagal mengambil data dari server.");
        }

        return await response.json();
    },

    /**
     * Semua POST request otomatis membawa token dari session
     * Backend wajib menerima token untuk verifyUser() + requirePermission()
     */
    async post(payload = {}) {
        const token = await this.getToken();

        const response = await fetch(CONFIG.API_URL, {
            method: "POST",
            // text/plain menghindari CORS preflight (OPTIONS)
            // yang tidak didukung Google Apps Script.
            // Body tetap JSON string, hanya content-type yang berbeda.
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
                token,
                ...payload
            })
        });

        if (!response.ok) {
            throw new Error("Gagal mengirim data ke server.");
        }

        return await response.json();
    },

    /**
     * Ambil produk — otomatis sertakan token jika user sudah login
     * Backend akan buka field harga berdasarkan permission dari token tersebut
     */
    async getProducts(params = {}) {
        const token = await this.getToken();

        const allParams = token
            ? { token, ...params }
            : params;

        const response = await this.get(
            ACTIONS.PRODUCTS,
            allParams
        );

        return {
            products:   response.data,
            filters:    response.filters,
            pagination: response.pagination,
            role:       response.role,
            priceArea:  response.priceArea
        };
    },

    async verify(googleIdToken) {
        return await this.get(
            ACTIONS.VERIFY,
            { token: googleIdToken }
        );
    },

    async createOrder(orderPayload) {
        return await this.post({
            action: ACTIONS.CREATE_ORDER,
            ...orderPayload
        });
    },

    async uploadPreview(headers, rows) {
        return await this.post({
            action:  ACTIONS.UPLOAD_PREVIEW,
            headers,
            rows
        });
    },

    async uploadImport(headers, rows, fileName = "") {
        return await this.post({
            action: ACTIONS.UPLOAD_IMPORT,
            headers,
            rows,
            fileName
        });
    },

    // ==========================================
    // Mapping & Unmapped (supervisor)
    // ==========================================

    async getMapping(q = "") {
        const token = await this.getToken();
        const params = { token };
        if (q) params.q = q;
        return await this.get(ACTIONS.GET_MAPPING, params);
    },

    async getUnmapped(status = "OPEN", page = 1) {
        const token = await this.getToken();
        return await this.get(ACTIONS.GET_UNMAPPED, { token, status, page });
    },

    async saveMapping(supplierKode, variantKode) {
        return await this.post({
            action:       ACTIONS.SAVE_MAPPING,
            supplierKode,
            variantKode
        });
    },

    async updateUnmapped(itemNo, status, note = "") {
        return await this.post({
            action: ACTIONS.UPDATE_UNMAPPED,
            itemNo,
            status,
            note
        });
    },

    // ==========================================
    // User Management (supervisor)
    // ==========================================

    async getUsers() {
        const token = await this.getToken();
        return await this.get(ACTIONS.GET_USERS, { token });
    },

    async saveUser(userData) {
        return await this.post({
            action: ACTIONS.SAVE_USER,
            ...userData
        });
    }

};
