// src/utils/promotionsData.js
import api from './api';

// Función para crear una promoción
export async function createPromotion({ walletAddress, token, promotionData }) {
    return api({
        method: 'POST',
        endpoint: '/promotions/create',
        data: promotionData,
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Función para obtener segmentos de meritocracia permitidos para la compañía (admin)
export async function fetchMeritSegments({ walletAddress, token }) {
    return api({
        method: 'GET',
        endpoint: '/admin/gamification/segments/list',
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Función para actualizar una promoción
export async function updatePromotion({ walletAddress, token, promotionId, promotionData }) {
    return api({
        method: 'PUT',
        endpoint: `/promotions/update/${promotionId}`,
        data: promotionData,
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Función para reclamar una promoción
export async function claimPromotion({ walletAddress, token, promotionId, signature, plainData, menu_item_sku }) {
    const data = {
        promotion_id: promotionId,
        wallet: walletAddress,
        signature,
        plain_data: plainData,
    };
    if (menu_item_sku) {
        data.menu_item_sku = menu_item_sku;
    }
    return api({
        method: 'POST',
        endpoint: '/promotions/claim',
        data,
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Función para quemar tokens para una promoción
export async function burnForPromotion({ walletAddress, token, promotionId, signature, plainData }) {
    const data = {
        promotion_id: promotionId,
        wallet: walletAddress,
        signature,
        plain_data: plainData,
    };
    return api({
        method: 'POST',
        endpoint: '/promotions/burn',
        data,
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Función para listar promociones activas
export async function fetchActivePromotions({ walletAddress, token }) {
    return api({
        method: 'GET',
        endpoint: '/promotions_claim/active',
        headers: {
            ...(walletAddress && {'X-Wallet-Address': walletAddress}),
            ...(token && {Authorization: `Bearer ${token}`}),
        },
    });
}

// Función para listar todas las promociones con filtros y paginación
export async function fetchAllPromotions({ walletAddress, token, page = 1, limit = 20, query = '', status = 'all', start_date = '', end_date = '' }) {
    const params = { page, limit };
    if (query) params.query = query;
    if (status !== 'all') params.status = status;
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
    return api({
        method: 'GET',
        endpoint: '/promotions/all',
        params,
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Función para reactivar un cupón
export async function reactivateCoupon({ walletAddress, token, couponCode }) {
    return api({
        method: 'POST',
        endpoint: '/promotions/coupon/reactivate',
        data: {
            coupon_code: couponCode,
        },
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Función para canjear un cupón manualmente (admin)
export async function redeemCoupon({ walletAddress, token, couponCode }) {
    return api({
        method: 'POST',
        endpoint: '/promotions/coupon/redeem',
        data: {
            coupon_code: couponCode,
        },
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Nueva función para listar cupones
export async function fetchCoupons({ walletAddress, token, page = 1, limit = 20, wallet = '', promotion = '', start_date = '', end_date = '', status = '' }) {
    const params = { page, limit };
    if (wallet) params.wallet = wallet;
    if (promotion) params.promotion = promotion;
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
    if (status) params.status = status;
    return api({
        method: 'GET',
        endpoint: '/promotions/coupons',
        params,
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Función para obtener el token API
export async function fetchApiToken({ walletAddress, token }) {
    return api({
        method: 'GET',
        endpoint: '/apikeys',
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Función para generar un nuevo token API
export async function generateApiToken({ walletAddress, token, name, expiry_months }) {
    return api({
        method: 'POST',
        endpoint: '/apikeys',
        data: {
            name,
            expiry_months
        },
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Función para obtener el saldo de puntos quemados
export async function getBurnedBalance({ walletAddress, tokenAddress, token }) {
    return api({
        method: 'GET',
        endpoint: '/promotions/burned-balance',
        params: {
            wallet: walletAddress,
            token_address: tokenAddress,
        },
        headers: {
            ...(walletAddress && {'X-Wallet-Address': walletAddress}),
            ...(token && {Authorization: `Bearer ${token}`}),
        },
    });
}

// Función para obtener mis cupones
export async function getMyCoupons({ walletAddress, token, page = 1, limit = 20, status = '' }) {
    const params = { page, limit };
    if (status) params.status = status;
    return api({
        method: 'GET',
        endpoint: '/promotions/my-coupons',
        params,
        headers: {
            ...(walletAddress && {'X-Wallet-Address': walletAddress}),
            ...(token && {Authorization: `Bearer ${token}`}),
        },
    });
}