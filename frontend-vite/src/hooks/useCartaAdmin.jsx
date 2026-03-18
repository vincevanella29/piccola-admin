import { useState, useCallback, useRef } from 'react';
import * as cartaApi from '../utils/cartaData';

const useCartaAdmin = (appState) => {
    const token = appState?.token;
    const account = appState?.account;

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [locations, setLocations] = useState([]);
    const [menuOptions, setMenuOptions] = useState([]);
    const [menuTypes, setMenuTypes] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState(null);
    const hasFetched = useRef(false);

    const fetchAll = useCallback(async (params = {}) => {
        if (!token) return;
        setIsLoading(true);
        setError(null);
        try {
            const [cats, prods, locs, opts, mTypes] = await Promise.all([
                cartaApi.fetchCategories({ token, account }),
                cartaApi.fetchProducts({ token, account, ...params }),
                cartaApi.fetchLocations({ token, account }),
                cartaApi.fetchMenuOptions({ token, account }),
                cartaApi.fetchMenuTypes({ token, account }),
            ]);
            setCategories(Array.isArray(cats) ? cats : []);
            setProducts(Array.isArray(prods) ? prods : []);
            setLocations(Array.isArray(locs) ? locs : []);
            setMenuOptions(Array.isArray(opts) ? opts : []);
            setMenuTypes(Array.isArray(mTypes) ? mTypes : []);
            hasFetched.current = true;
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [token, account]);

    const refresh = useCallback((params = {}) => {
        hasFetched.current = false;
        fetchAll(params);
    }, [fetchAll]);

    const createProduct = useCallback(async (data) => {
        const result = await cartaApi.createProduct({ token, account, data });
        return result;
    }, [token, account]);

    const updateProduct = useCallback(async (productId, data) => {
        const result = await cartaApi.updateProduct({ token, account, productId, data });
        return result;
    }, [token, account]);

    /**
     * patchProduct — actualiza un producto en el array en memoria SIN re-fetch.
     * Úsalo cuando ya tienes los datos nuevos (ej: organize-media retornó las URLs).
     * El update de MongoDB ya ocurrió en el backend.
     */
    const patchProduct = useCallback((productId, fields) => {
        setProducts(prev => prev.map(p =>
            String(p.id) === String(productId) ? { ...p, ...fields } : p
        ));
    }, []);

    const createCategory = useCallback(async (data) => {
        const result = await cartaApi.createCategory({ token, account, data });
        return result;
    }, [token, account]);

    const updateCategory = useCallback(async (categoryId, data) => {
        const result = await cartaApi.updateCategory({ token, account, categoryId, data });
        return result;
    }, [token, account]);

    const uploadProductImage = useCallback(async (file) => {
        const result = await cartaApi.uploadProductImage({ token, account, file });
        return result?.url;
    }, [token, account]);

    const syncExternal = useCallback(async () => {
        setIsSyncing(true);
        setError(null);
        try {
            const result = await cartaApi.syncExternalCarta({ token, account });
            await fetchAll();
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setIsSyncing(false);
        }
    }, [token, account, fetchAll]);

    const removeProduct = useCallback(async (productId) => {
        return await cartaApi.deleteProduct({ token, account, productId });
    }, [token, account]);

    const removeCategory = useCallback(async (categoryId) => {
        return await cartaApi.deleteCategory({ token, account, categoryId });
    }, [token, account]);

    const massDeleteProducts = useCallback(async (ids) => {
        return await cartaApi.bulkDeleteProducts({ token, account, ids });
    }, [token, account]);

    const massDeleteCategories = useCallback(async (ids) => {
        return await cartaApi.bulkDeleteCategories({ token, account, ids });
    }, [token, account]);

    const loadProductMtzData = useCallback(async (productId) => {
        return await cartaApi.fetchProductMtzData({ token, account, productId });
    }, [token, account]);

    const loadMtzMissingProducts = useCallback(async () => {
        return await cartaApi.fetchMtzMissingProducts({ token, account });
    }, [token, account]);

    const fetchLocationsList = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const result = await cartaApi.fetchLocations({ token, account });
            setLocations(Array.isArray(result) ? result : []);
            return result;
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [token, account]);

    const updateLocationButtons = useCallback(async (locationId, custom_buttons) => {
        return await cartaApi.updateLocationButtons({ token, account, locationId, custom_buttons });
    }, [token, account]);

    const triggerSync = useCallback(async () => {
        return await cartaApi.triggerPublicSync({ token, account });
    }, [token, account]);

    const cleanDuplicates = useCallback(async () => {
        return await cartaApi.cleanDatabaseDuplicates({ token, account });
    }, [token, account]);

    const updateEspecial = useCallback(async (productId, data) => {
        return await cartaApi.updateProductEspecial({ token, account, productId, data });
    }, [token, account]);

    const moveOptionValue = useCallback(async (optionId, valueId, targetOptionId) => {
        return await cartaApi.moveMenuOptionValue({ token, account, optionId, valueId, targetOptionId });
    }, [token, account]);

    const createNewMenuType = useCallback(async (data) => {
        return await cartaApi.createMenuType({ token, account, data });
    }, [token, account]);

    const deleteOneMenuType = useCallback(async (slug) => {
        return await cartaApi.deleteMenuType({ token, account, slug });
    }, [token, account]);

    const reorder = useCallback(async (items) => {
        await cartaApi.reorderProducts({ token, account, items });
    }, [token, account]);

    return {
        products,
        categories,
        locations,
        menuOptions,
        menuTypes,
        isLoading,
        isSyncing,
        error,
        fetchAll,
        refresh,
        patchProduct,
        updateProduct,
        createProduct,
        updateCategory,
        createCategory,
        uploadProductImage,
        syncExternal,
        triggerPublicSync: triggerSync,
        cleanDatabaseDuplicates: cleanDuplicates,
        fetchLocations: fetchLocationsList,
        updateLocationButtons,
        deleteProduct: removeProduct,
        deleteCategory: removeCategory,
        bulkDeleteProducts: massDeleteProducts,
        bulkDeleteCategories: massDeleteCategories,
        fetchProductMtzData: loadProductMtzData,
        fetchMtzMissingProducts: loadMtzMissingProducts,
        updateProductEspecial: updateEspecial,
        moveMenuOptionValue: moveOptionValue,
        createMenuType: createNewMenuType,
        deleteMenuType: deleteOneMenuType,
        reorderProducts: reorder,
    };
};

export default useCartaAdmin;
