import api, { apiform } from './api';

const authHeaders = (token, account) => ({
    Authorization: `Bearer ${token}`,
    ...(account ? { 'X-Wallet-Address': account } : {}),
});

// ── Products ───────────────────────────────────────
export const fetchProducts = async ({ token, account, search, category_id, only_active } = {}) => {
    const params = {};
    if (search) params.search = search;
    if (category_id) params.category_id = category_id;
    if (only_active) params.only_active = true;
    return api({
        method: 'GET',
        endpoint: '/carta/products',
        params,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const createProduct = async ({ token, account, data }) => {
    return api({
        method: 'POST',
        endpoint: '/carta/products',
        data,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const updateProduct = async ({ token, account, productId, data }) => {
    return api({
        method: 'PUT',
        endpoint: `/carta/products/${productId}`,
        data,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const uploadProductImage = async ({ token, account, file }) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiform({
        method: 'POST',
        endpoint: '/carta/products/upload-image',
        data: formData,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const uploadProductVideo = async ({ token, account, file }) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiform({
        method: 'POST',
        endpoint: '/carta/products/upload-video',
        data: formData,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};


export const deleteProduct = async ({ token, account, productId }) => {
    return api({
        method: 'DELETE',
        endpoint: `/carta/products/${productId}`,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const fetchProductMtzData = async ({ token, account, productId }) => {
    return api({
        method: 'GET',
        endpoint: `/carta/products/${productId}/mtz-data`,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const fetchMtzMissingProducts = async ({ token, account }) => {
    return api({
        method: 'GET',
        endpoint: '/carta/mtz-missing',
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const fetchMenuOptions = async ({ token, account }) => {
    return api({
        method: 'GET',
        endpoint: '/carta/menu-options',
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const updateMenuOptionValue = async ({ token, account, optionId, valueId, data }) => {
    return api({
        method: 'PUT',
        endpoint: `/carta/menu-options/${optionId}/values/${valueId}`,
        data,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const deleteMenuOptionValue = async ({ token, account, optionId, valueId }) => {
    return api({
        method: 'DELETE',
        endpoint: `/carta/menu-options/${optionId}/values/${valueId}`,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const deleteMenuOption = async ({ token, account, optionId }) => {
    return api({
        method: 'DELETE',
        endpoint: `/carta/menu-options/${optionId}`,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const bulkDeleteProducts = async ({ token, account, ids }) => {
    return api({
        method: 'POST',
        endpoint: '/carta/products/bulk-delete',
        data: { ids },
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const reorderProducts = async ({ token, account, items }) => {
    return api({
        method: 'POST',
        endpoint: '/carta/products/reorder',
        data: { items },
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

// ── Categories ─────────────────────────────────────
export const fetchCategories = async ({ token, account, only_active } = {}) => {
    const params = {};
    if (only_active) params.only_active = true;
    return api({
        method: 'GET',
        endpoint: '/carta/categories',
        params,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const createCategory = async ({ token, account, data }) => {
    return api({
        method: 'POST',
        endpoint: '/carta/categories',
        data,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const updateCategory = async ({ token, account, categoryId, data }) => {
    return api({
        method: 'PUT',
        endpoint: `/carta/categories/${categoryId}`,
        data,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const deleteCategory = async ({ token, account, categoryId }) => {
    return api({
        method: 'DELETE',
        endpoint: `/carta/categories/${categoryId}`,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const bulkDeleteCategories = async ({ token, account, ids }) => {
    return api({
        method: 'POST',
        endpoint: '/carta/categories/bulk-delete',
        data: { ids },
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

// ── Menu Types ─────────────────────────────────────
export const fetchMenuTypes = async ({ token, account } = {}) => {
    return api({
        method: 'GET',
        endpoint: '/carta/menu-types',
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const createMenuType = async ({ token, account, data }) => {
    return api({
        method: 'POST',
        endpoint: '/carta/menu-types',
        data,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const updateMenuType = async ({ token, account, slug, data }) => {
    return api({
        method: 'PUT',
        endpoint: `/carta/menu-types/${slug}`,
        data,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const deleteMenuType = async ({ token, account, slug }) => {
    return api({
        method: 'DELETE',
        endpoint: `/carta/menu-types/${slug}`,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

// ── External Sync ──────────────────────────────────
export const syncExternalCarta = async ({ token, account }) => {
    return api({
        method: 'POST',
        endpoint: '/carta/sync-external',
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const triggerPublicSync = async ({ token, account }) => {
    return api({
        method: 'POST',
        endpoint: '/carta/trigger-public-sync',
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const triggerBannersSync = async ({ token, account }) => {
    return api({
        method: 'POST',
        endpoint: '/banners/trigger-sync',
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const cleanDatabaseDuplicates = async ({ token, account }) => {
    return api({
        method: 'POST',
        endpoint: '/carta/debug/clean-duplicates',
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

// ── Locations ──────────────────────────────────────
export const fetchLocations = async ({ token, account } = {}) => {
    return api({
        method: 'GET',
        endpoint: '/carta/locations',
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const updateLocationButtons = async ({ token, account, locationId, custom_buttons }) => {
    return api({
        method: 'PUT',
        endpoint: `/carta/locations/${locationId}/buttons`,
        data: { custom_buttons },
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

// ── AI Imagen ──────────────────────────────────────
export const generateProductAIImage = async ({ token, account, payload }) => {
    return api({
        method: 'POST',
        endpoint: '/carta/ai-imagen/generate',
        data: payload,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const generateProductAIVideo = async ({ token, account, payload }) => {
    return api({
        method: 'POST',
        endpoint: '/carta/ai-imagen/generate-video',
        data: payload,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const generateProductAIDescription = async ({ token, account, payload }) => {
    return api({
        method: 'POST',
        endpoint: '/carta/ai-imagen/generate-description',
        data: payload,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const sendAIImagenFeedback = async ({ token, account, payload }) => {
    return api({
        method: 'POST',
        endpoint: '/carta/ai-imagen/feedback',
        data: payload,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const organizeProductMedia = async ({ token, account, productId, images, videoUrl }) => {
    return api({
        method: 'POST',
        endpoint: `/carta/products/${productId}/organize-media`,
        data: { images, video_url: videoUrl || null },
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const fetchProductAIHistory = async ({ token, account, productId, limit = 30 }) => {
    return api({
        method: 'GET',
        endpoint: `/carta/ai-imagen/history/${productId}?limit=${limit}`,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

// ── Especial (precios especiales) ──────────────────────────────────────────────
export const updateProductEspecial = async ({ token, account, productId, data }) => {
    return api({
        method: 'PATCH',
        endpoint: `/carta/products/${productId}/especial`,
        data,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

// ── Move menu option value ─────────────────────────────────────────────────────
export const moveMenuOptionValue = async ({ token, account, optionId, valueId, targetOptionId }) => {
    return api({
        method: 'POST',
        endpoint: `/carta/menu-options/${optionId}/values/${valueId}/move`,
        data: { target_option_id: targetOptionId },
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

// ── Menu Option duplicates ─────────────────────────────────────────────────────
export const fetchDuplicateOptionCodigos = async ({ token, account }) => {
    return api({
        method: 'GET',
        endpoint: '/carta/menu-options/duplicates',
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

export const removeDuplicateOptionValues = async ({ token, account, dryRun = false }) => {
    return api({
        method: 'POST',
        endpoint: `/carta/menu-options/remove-duplicates?dry_run=${dryRun}`,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

// ── Create option group ────────────────────────────────────────────────────────
export const createMenuOptionGroup = async ({ token, account, data }) => {
    return api({
        method: 'POST',
        endpoint: '/carta/menu-options',
        data,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

// ── Modifier ↔ Product linking ─────────────────────────────────────────────────
/** Get all modifier groups linked to a product (menu_id == product._id) */
export const fetchProductModifiers = async ({ token, account, productId }) => {
    return api({
        method: 'GET',
        endpoint: `/carta/products/${productId}/modifiers`,
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};

/**
 * Link a modifier group to a product (sets menu_id = productId).
 * Pass productId="" to unlink.
 */
export const linkModifierToProduct = async ({ token, account, optionId, productId }) => {
    return api({
        method: 'PATCH',
        endpoint: `/carta/menu-options/${optionId}/link`,
        data: { product_id: productId },
        headers: authHeaders(token, account),
        withCredentials: true,
    });
};
