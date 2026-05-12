// hooks/useCartaProviders.jsx
// Hook for carta provider management — pages never call utils directly
// Used by: pages/banners/components/CartaProviderManager.jsx
import { useState, useCallback, useRef } from 'react';
import {
    fetchCartaProviders as apiFetchProviders,
    fetchCartaProviderPresets as apiFetchPresets,
    probeCartaDomain as apiProbe,
    autoLinkCarta as apiAutoLink,
    deleteCartaProvider as apiDelete,
    resyncCartaProvider as apiResync,
} from '../utils/cartaData';

const useCartaProviders = (appState) => {
    const [providers, setProviders] = useState([]);
    const [presets, setPresets] = useState({});
    const [routes, setRoutes] = useState({});
    const [loading, setLoading] = useState(true);

    const appRef = useRef(appState);
    appRef.current = appState;

    const getAuth = useCallback(() => ({
        token: appRef.current?.token,
        account: appRef.current?.account,
    }), []);

    const fetchProviders = useCallback(async () => {
        try {
            setLoading(true);
            const [provRes, presetRes] = await Promise.all([
                apiFetchProviders(getAuth()),
                apiFetchPresets(getAuth()),
            ]);
            setProviders(provRes?.providers || []);
            setPresets(presetRes?.presets || {});
            setRoutes(presetRes?.routes || {});
        } catch (e) {
            console.error('Error loading carta providers:', e);
        } finally {
            setLoading(false);
        }
    }, [getAuth]);

    const probeDomain = useCallback(async (domain) => {
        return apiProbe({ ...getAuth(), domain });
    }, [getAuth]);

    const autoLink = useCallback(async (payload) => {
        const preset = presets?.carta || {};
        const res = await apiAutoLink({
            ...getAuth(),
            name: payload.name || preset.name || 'Carta Digital',
            slug: payload.slug || preset.slug || 'carta',
            type: payload.type || 'api_key',
            domain: payload.domain,
            description: payload.description || preset.description || '',
        });
        await fetchProviders();
        return res;
    }, [getAuth, presets, fetchProviders]);

    const disableProvider = useCallback(async (providerId) => {
        await apiDelete({ ...getAuth(), providerId });
        await fetchProviders();
    }, [getAuth, fetchProviders]);

    const resyncProvider = useCallback(async (providerId) => {
        return apiResync({ ...getAuth(), providerId });
    }, [getAuth]);

    return {
        providers, presets, routes, loading,
        fetchProviders, probeDomain, autoLink, disableProvider, resyncProvider,
    };
};

export default useCartaProviders;
