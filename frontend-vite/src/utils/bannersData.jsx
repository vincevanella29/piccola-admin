import api, { apiform } from './api';

export const fetchBanners = async ({ token, account }) => {
    return await api({
        method: 'GET',
        endpoint: '/banners',
        headers: {
            Authorization: `Bearer ${token}`,
            ...(account ? { 'X-Wallet-Address': account } : {}),
        },
        withCredentials: true,
    });
};

export const createBanner = async ({ token, account, bannerData }) => {
    return await api({
        method: 'POST',
        endpoint: '/banners',
        data: bannerData,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(account ? { 'X-Wallet-Address': account } : {}),
        },
        withCredentials: true,
    });
};

export const updateBanner = async ({ token, account, bannerId, bannerData }) => {
    return await api({
        method: 'PUT',
        endpoint: `/banners/${bannerId}`,
        data: bannerData,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(account ? { 'X-Wallet-Address': account } : {}),
        },
        withCredentials: true,
    });
};

export const deleteBanner = async ({ token, account, bannerId }) => {
    return await api({
        method: 'DELETE',
        endpoint: `/banners/${bannerId}`,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(account ? { 'X-Wallet-Address': account } : {}),
        },
        withCredentials: true,
    });
};

export const uploadBannerImage = async ({ token, account, file }) => {
    const formData = new FormData();
    formData.append('file', file);

    return await apiform({
        method: 'POST',
        endpoint: '/banners/upload',
        data: formData,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(account ? { 'X-Wallet-Address': account } : {}),
        },
        withCredentials: true,
    });
};

export const generateBannerAI = async ({ token, account, data }) => {
    return await api({
        method: 'POST',
        endpoint: '/banners/ai-generate',
        data,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(account ? { 'X-Wallet-Address': account } : {}),
        },
        withCredentials: true,
    });
};

export const fetchBannerAIHistory = async ({ token, account, limit = 50 }) => {
    return await api({
        method: 'GET',
        endpoint: `/banners/ai-history?limit=${limit}`,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(account ? { 'X-Wallet-Address': account } : {}),
        },
        withCredentials: true,
    });
};

export const fetchBannerAIStyles = async ({ token, account }) => {
    return await api({
        method: 'GET',
        endpoint: '/banners/ai-styles',
        headers: {
            Authorization: `Bearer ${token}`,
            ...(account ? { 'X-Wallet-Address': account } : {}),
        },
        withCredentials: true,
    });
};
