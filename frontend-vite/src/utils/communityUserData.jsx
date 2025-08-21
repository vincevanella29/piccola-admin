// src/utils/communityUserData.js
import api, { apiform } from './api';

// Función para obtener el perfil propio del usuario
export async function fetchUserProfile({ walletAddress, token }) {
    return api({
        method: 'GET',
        endpoint: '/community_users/profile',
        headers: {
            ...(walletAddress && {'X-Wallet-Address': walletAddress}),
            ...(token && {Authorization: `Bearer ${token}`}),
        },
    });
}

// Función para obtener el perfil público de cualquier wallet
export async function fetchPublicProfile({ wallet, walletAddress, token }) {
    return api({
        method: 'GET',
        endpoint: `/community_users/profile/${wallet}`,
        headers: {
            ...(walletAddress && {'X-Wallet-Address': walletAddress}),
            ...(token && {Authorization: `Bearer ${token}`}),
        },
    });
}

// Función para crear o actualizar el perfil del usuario
export async function updateUserProfile({ walletAddress, token, profileData }) {
    return api({
        method: 'POST',
        endpoint: '/community_users/profile',
        data: profileData,
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Función para actualizar la ubicación favorita
export async function updateFavoriteLocation({ walletAddress, token, locationId }) {
    return api({
        method: 'PUT',
        endpoint: '/community_users/favorite_location',
        data: { location_id: locationId },
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Función para actualizar el like de un producto
export async function updateProductLike({ walletAddress, token, productId, like }) {
    return api({
        method: 'PUT',
        endpoint: '/community_users/like_product',
        data: { product_id: productId, like },
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Función para actualizar la imagen de perfil
export async function updateProfileImage({ walletAddress, token, profileImage }) {
    const form = new FormData();
    form.append('profile_image', profileImage);
    return apiform({
        method: 'PUT',
        endpoint: '/community_users/profile_image',
        data: form,
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Función para togglear campos booleanos
export async function updateToggle({ walletAddress, token, field, value }) {
    return api({
        method: 'PUT',
        endpoint: '/community_users/toggle',
        data: { field, value },
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}

// Función para obtener rankings de comunidad
export async function fetchCommunityRankings() {
    return api({
        method: 'GET',
        endpoint: '/community_users/rankings',
    });
}

export async function updateProfileField({ walletAddress, token, field, value }) {
    return api({
        method: 'PUT',
        endpoint: '/community_users/profile_field',
        data: { field, value },
        headers: {
            'X-Wallet-Address': walletAddress,
            Authorization: `Bearer ${token}`,
        },
    });
}