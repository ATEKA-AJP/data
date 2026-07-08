/**
 * ==========================================
 * AJP WEB CATALOG
 * Global Constants
 * ==========================================
 */

const ACTIONS = Object.freeze({

    PRODUCTS: "products",

    VERIFY: "verify",

    CREATE_ORDER: "createOrder",

    UPLOAD_PREVIEW: "uploadPreview",

    UPLOAD_IMPORT: "uploadImport",

    GET_MAPPING: "getMapping",

    GET_UNMAPPED: "getUnmapped",

    SAVE_MAPPING: "saveMapping",

    UPDATE_MAPPING: "updateMapping",

    UPDATE_UNMAPPED: "updateUnmapped",

    GET_USERS: "getUsers",

    SAVE_USER: "saveUser"

});

const ORDER_STATUS = Object.freeze({

    PENDING: "pending",

    REVIEW: "review",

    SENT: "sent"

});

const USER_ROLE = Object.freeze({

    PUBLIC: "public",

    SALES: "sales",

    SUPERVISOR: "supervisor",

    ADMIN: "admin"

});