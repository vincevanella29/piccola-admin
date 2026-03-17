import { useState, useCallback } from 'react';
import * as bannerApi from '../utils/bannersData';

export function useBannersAdmin(appState, t) {
    const [banners, setBanners] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const token = appState?.token;
    const account = appState?.account;

    const refreshBanners = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await bannerApi.fetchBanners({ token, account });
            setBanners(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [token, account]);

    const create = async (bannerData) => {
        setIsLoading(true);
        setError(null);
        try {
            const resp = await bannerApi.createBanner({ token, account, bannerData });
            await refreshBanners();
            return resp;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const update = async (bannerId, bannerData) => {
        setIsLoading(true);
        setError(null);
        try {
            const resp = await bannerApi.updateBanner({ token, account, bannerId, bannerData });
            await refreshBanners();
            return resp;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const remove = async (bannerId) => {
        setIsLoading(true);
        setError(null);
        try {
            await bannerApi.deleteBanner({ token, account, bannerId });
            await refreshBanners();
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const uploadImage = async (file) => {
        setIsLoading(true);
        setError(null);
        try {
            const resp = await bannerApi.uploadBannerImage({ token, account, file });
            return resp.url;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        banners,
        isLoading,
        error,
        refreshBanners,
        create,
        update,
        remove,
        uploadImage
    };
}

export default useBannersAdmin;
