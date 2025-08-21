import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchLocations, fetchMenus, updateLocation as apiUpdateLocation, uploadLocationPhotos as apiUploadLocationPhotos } from '../utils/clubNonnaData';
import { normalizeLocationsApiResponse } from './useRestaurantUtils';

// Configuración del caché
const CACHE_KEY = 'restaurant_data';
const CACHE_TTL = 60 * 60 * 1; // 1 hora en milisegundos
const SELECTED_LOCATION_KEY = 'selected_location';
const SELECTED_CATEGORY_KEY = 'selected_category';

// Helper para obtener datos del caché
const getCachedData = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    console.log('cached', cached);
    if (!cached) return null;

    const { timestamp, data } = JSON.parse(cached);
    const now = Date.now();

    // Verificar si el caché no ha expirado
    if (now - timestamp < CACHE_TTL) {
      return data;
    }
    return null;
  } catch (e) {
    console.error('Error reading cache:', e);
    return null;
  }
};

// Helper para guardar datos en el caché
const saveToCache = (data) => {
  try {
    const cacheData = {
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (e) {
    console.error('Error saving to cache:', e);
  }
};

// Helper para obtener la ubicación seleccionada del caché
const getCachedSelectedLocation = () => {
  try {
    const cached = localStorage.getItem(SELECTED_LOCATION_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.error('Error reading cached selected location:', e);
    return null;
  }
};

// Helper para obtener la categoría seleccionada del caché
const getCachedSelectedCategory = () => {
  try {
    const cached = localStorage.getItem(SELECTED_CATEGORY_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.error('Error reading cached selected category:', e);
    return null;
  }
};

// Helper para guardar la ubicación seleccionada en el caché
const saveSelectedLocation = (location) => {
  try {
    localStorage.setItem(SELECTED_LOCATION_KEY, JSON.stringify(location));
  } catch (e) {
    console.error('Error saving selected location:', e);
  }
};

// Helper para guardar la categoría seleccionada en el caché
const saveSelectedCategory = (category) => {
  try {
    localStorage.setItem(SELECTED_CATEGORY_KEY, JSON.stringify(category));
  } catch (e) {
    console.error('Error saving selected category:', e);
  }
};

const useRestaurantData = (appState = {}) => {
  const [allLocations, setAllLocations] = useState([]);
  const [allMenus, setAllMenus] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [menuOptions, setMenuOptions] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(getCachedSelectedLocation());
  const [selectedCategory, setSelectedCategory] = useState(getCachedSelectedCategory());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Admin action loading/error states
  const [actionLoading, setActionLoading] = useState({
    refresh: false,
    updateLocation: false,
    uploadPhotos: false,
  });
  const [actionError, setActionError] = useState({
    updateLocation: null,
    uploadPhotos: null,
  });

  // Guard to avoid setState after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setSafeState = useCallback((setter, value) => {
    if (mountedRef.current) setter(value);
  }, []);

  const fetchData = async (forceRefresh = false) => {
    // Intentar cargar desde el caché si no se fuerza un refresco
    if (!forceRefresh) {
      const cachedData = getCachedData();
      if (cachedData) {
        setAllLocations(cachedData.locations || []);
        setAllMenus(cachedData.menus || []);
        setAllCategories(cachedData.categories || []);
        setMenuOptions(cachedData.menuOptions || []);

        if (cachedData.locations?.length > 0 && !selectedLocation) {
          const sortedLocations = [...cachedData.locations].sort((a, b) => Number(a._id) - Number(b._id));
          setSelectedLocation(sortedLocations[0]);
          saveSelectedLocation(sortedLocations[0]);
        }

        setIsLoading(false);
        return;
      }
    }

    // Si no hay caché o se fuerza refresco, hacer fetch
    setIsLoading(true);
    setError(null);
    try {
      const hasAuth = Boolean(appState?.token);
      const menusPromise = hasAuth
        ? fetchMenus(appState.account, appState.token)
        : Promise.resolve({ menus: [], categories: [], menu_options: [] });

      const [locationsRes, menusRes] = await Promise.all([
        fetchLocations(),
        menusPromise,
      ]);
      console.log('menusRes', menusRes);
      console.log('locationsRes', locationsRes);

      if (locationsRes.error) throw new Error(`Error en locales: ${locationsRes.error}`);
      if (menusRes.error) throw new Error(`Error en menús: ${menusRes.error}`);
      
      const locations = normalizeLocationsApiResponse(locationsRes);
      const menusdatalist = (menusRes.menus || []).map(menu => ({
        ...menu,
        _id: String(menu._id || menu.id),
      })) || [];
      
      console.log('menusdatalist', menusdatalist);
      const categories = menusRes.categories || [];
      const menuOptions = menusRes.menu_options || [];

      setAllLocations(locations);
      setAllMenus(menusdatalist);
      setAllCategories(categories);
      setMenuOptions(menuOptions);

      // Guardar en caché
      saveToCache({
        locations,
        menus: menusdatalist,
        categories,
        menuOptions,
      });

      if (locations.length > 0 && !selectedLocation) {
        const sortedLocations = [...locations].sort((a, b) => Number(a._id) - Number(b._id));
        setSelectedLocation(sortedLocations[0]);
        saveSelectedLocation(sortedLocations[0]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const data = useMemo(() => {
    if (!selectedLocation) {
      return { locations: allLocations, categories: [], menus: [], allLocationMenus: [], mediaMap: {} };
    }

    const selectedLocationId = String(selectedLocation?.id || selectedLocation?._id || selectedLocation?.nombre);
    const locationMenuIds = new Set(selectedLocation.menu_ids?.map(String) || []);

    const visibleCategories = allCategories
      .filter(cat => {
        if (!cat.estado) return false;
        const categoryMenuIds = cat.menu_ids?.map(String) || [];
        if (!categoryMenuIds.length) return false;
        if (!cat.location_ids || cat.location_ids.length === 0) return true;
        return cat.location_ids.map(String).includes(selectedLocationId);
      })
      .sort((a, b) => (a.prioridad ?? 999) - (b.prioridad ?? 999));

    const selectedCategoryId = selectedCategory && (selectedCategory._id || selectedCategory.id) ? String(selectedCategory._id || selectedCategory.id) : null;
    let productosVisibles = [];
    if (selectedCategoryId && selectedCategory) {
      productosVisibles = allMenus.filter(menu => {
        const menuCategoryIds = Array.isArray(menu.category_ids) ? menu.category_ids.map(String) : [];
        if (!menuCategoryIds.length) return false;
        if (!menuCategoryIds.includes(selectedCategoryId)) return false;
        if (!menu.location_ids || menu.location_ids.length === 0) return true;
        if (!menu.location_ids.map(String).includes(selectedLocationId)) return false;
        if (Array.isArray(menu.restriccion) && menu.restriccion.length > 0) {
          return menu.restriccion.includes('dinein');
        }
        return true;
      }).map(menu => {
        const optionIds = Array.isArray(menu.option_ids) ? menu.option_ids.map(String) : [];
        const options = optionIds
          .map(optId => (menuOptions || []).find(opt => String(opt.id) === optId || String(opt._id) === optId))
          .filter(Boolean);
        return { ...menu, options };
      });
    }

    const allLocationMenus = allMenus.filter(menu => {
      if (!menu.location_ids || menu.location_ids.length === 0) return true;
      if (!menu.location_ids.map(String).includes(selectedLocationId)) return false;
      if (Array.isArray(menu.restriccion) && menu.restriccion.length > 0) {
        return menu.restriccion.includes('dinein');
      }
      return true;
    }).map(menu => {
      const optionIds = Array.isArray(menu.option_ids) ? menu.option_ids.map(String) : [];
      const options = optionIds
        .map(optId => (menuOptions || []).find(opt => String(opt.id) === optId || String(opt._id) === optId))
        .filter(Boolean);
      return { ...menu, options };
    });

    const mediaMap = allMenus.reduce((map, menu) => {
      if (menu.media_id && menu.media_url) {
        map[menu.media_id] = menu.media_url;
      }
      return map;
    }, {});

    return {
      locations: allLocations,
      categories: visibleCategories,
      menus: productosVisibles,
      allLocationMenus,
      mediaMap,
      menuOptions,
    };
  }, [selectedLocation, selectedCategory, allLocations, allMenus, allCategories, menuOptions]);

  const handleLocationChange = (location) => {
    setSelectedLocation(location);
    saveSelectedLocation(location);
    // No forzamos un refresh aquí para aprovechar el caché
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    saveSelectedCategory(category);
  };

  useEffect(() => {
    const visibleCategories = data.categories || [];
    if (visibleCategories.length > 0 && (!selectedCategory || !visibleCategories.some(c => c._id === selectedCategory._id))) {
      setSelectedCategory(visibleCategories[0]);
      saveSelectedCategory(visibleCategories[0]);
    } else if (visibleCategories.length === 0) {
      setSelectedCategory(null);
      saveSelectedCategory(null);
    }
  }, [data.categories]);

  // Admin: update a location
  const updateLocation = useCallback(
    async ({ locationId, data }) => {
      setSafeState(setActionError, (s) => ({ ...s, updateLocation: null }));
      setSafeState(setActionLoading, (s) => ({ ...s, updateLocation: true }));
      try {
        const { location } = await apiUpdateLocation({
          locationId,
          data,
          walletAddress: appState?.account,
          token: appState?.token,
        });
        const updatedId = String(location?._id ?? location?.id ?? locationId);
        setSafeState(setAllLocations, (prev) =>
          prev.map((loc) => {
            const locId = String(loc?._id ?? loc?.id);
            return locId === updatedId ? { ...loc, ...location } : loc;
          })
        );
        return location || null;
      } catch (e) {
        const msg = e?.response?.data?.detail || e?.message || 'Error actualizando local';
        setSafeState(setActionError, (s) => ({ ...s, updateLocation: msg }));
        return null;
      } finally {
        setSafeState(setActionLoading, (s) => ({ ...s, updateLocation: false }));
      }
    },
    [appState?.account, appState?.token, setSafeState]
  );

  // Admin: upload photos to a location
  const uploadLocationPhotos = useCallback(
    async ({ locationId, files }) => {
      setSafeState(setActionError, (s) => ({ ...s, uploadPhotos: null }));
      setSafeState(setActionLoading, (s) => ({ ...s, uploadPhotos: true }));
      try {
        const { urls = [] } = await apiUploadLocationPhotos({
          locationId,
          files,
          walletAddress: appState?.account,
          token: appState?.token,
        });
        setSafeState(setAllLocations, (prev) =>
          prev.map((loc) => {
            const locId = String(loc?._id ?? loc?.id);
            if (locId !== String(locationId)) return loc;
            const current = Array.isArray(loc.media_urls) ? loc.media_urls : [];
            return { ...loc, media_urls: [...current, ...urls] };
          })
        );
        return urls;
      } catch (e) {
        const msg = e?.response?.data?.detail || e?.message || 'Error subiendo fotos';
        setSafeState(setActionError, (s) => ({ ...s, uploadPhotos: msg }));
        return null;
      } finally {
        setSafeState(setActionLoading, (s) => ({ ...s, uploadPhotos: false }));
      }
    },
    [appState?.account, appState?.token, setSafeState]
  );

  return {
    data,
    locations: allLocations,
    isLoading,
    error,
    refresh: () => fetchData(true), // Forzar refresco del caché
    selectedLocation,
    setSelectedLocation: handleLocationChange,
    selectedCategory,
    setSelectedCategory: handleCategoryChange,
    // Admin actions
    updateLocation,
    uploadLocationPhotos,
    actionLoading,
    actionError,
  };
};

export default useRestaurantData;