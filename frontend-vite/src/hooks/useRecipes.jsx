import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchLocations, fetchMenusRecipes, updateLocation as apiUpdateLocation, uploadLocationPhotos as apiUploadLocationPhotos } from '../utils/clubNonnaData';
import { normalizeLocationsApiResponse } from './useRestaurantUtils';

const SELECTED_LOCATION_KEY = 'selected_location_recipes';
const SELECTED_CATEGORY_KEY = 'selected_category_recipes';

const getCachedSelectedLocation = () => {
  try {
    const cached = localStorage.getItem(SELECTED_LOCATION_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.error('Error reading cached selected location (recipes):', e);
    return null;
  }
};

const getCachedSelectedCategory = () => {
  try {
    const cached = localStorage.getItem(SELECTED_CATEGORY_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.error('Error reading cached selected category (recipes):', e);
    return null;
  }
};

const saveSelectedLocation = (location) => {
  try {
    localStorage.setItem(SELECTED_LOCATION_KEY, JSON.stringify(location));
  } catch (e) {
    console.error('Error saving selected location (recipes):', e);
  }
};

const saveSelectedCategory = (category) => {
  try {
    localStorage.setItem(SELECTED_CATEGORY_KEY, JSON.stringify(category));
  } catch (e) {
    console.error('Error saving selected category (recipes):', e);
  }
};

const useRecipes = (appState = {}) => {
  const [allLocations, setAllLocations] = useState([]);
  const [allMenus, setAllMenus] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [menuOptions, setMenuOptions] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(getCachedSelectedLocation());
  const [selectedCategory, setSelectedCategory] = useState(getCachedSelectedCategory());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const setSafeState = useCallback((setter, value) => {
    if (mountedRef.current) setter(value);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const hasAuth = Boolean(appState?.token);
      const menusPromise = hasAuth
        ? fetchMenusRecipes(appState.account, appState.token)
        : Promise.resolve({ menus: [], categories: [], menu_options: [] });

      const [locationsRes, menusRes] = await Promise.all([
        fetchLocations(),
        menusPromise,
      ]);

      if (locationsRes.error) throw new Error(`Error en locales: ${locationsRes.error}`);
      if (menusRes.error) throw new Error(`Error en menús: ${menusRes.error}`);

      const locations = normalizeLocationsApiResponse(locationsRes);
      const menusdatalist = (menusRes.menus || []).map(menu => ({
        ...menu,
        _id: String(menu._id || menu.id),
      })) || [];

      const categories = menusRes.categories || [];
      const menuOptionsRes = menusRes.menu_options || [];

      setAllLocations(locations);
      setAllMenus(menusdatalist);
      setAllCategories(categories);
      setMenuOptions(menuOptionsRes);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = useMemo(() => {
    if (!selectedLocation) {
      return { locations: allLocations, categories: [], menus: [], allLocationMenus: [], mediaMap: {} };
    }

    const selectedLocationId = String(selectedLocation?.id || selectedLocation?._id || selectedLocation?.nombre);

    const visibleCategories = allCategories
      .filter(cat => {
        if (!cat.estado) return false;
        const categoryMenuIds = cat.menu_ids?.map(String) || [];
        if (!categoryMenuIds.length) return false;
        if (!cat.location_ids || cat.location_ids.length === 0) return true;
        return cat.location_ids.map(String).includes(selectedLocationId);
      })
      .sort((a, b) => (a.prioridad ?? 999) - (b.prioridad ?? 999));

    const selectedCategoryId = selectedCategory && (selectedCategory._id || selectedCategory.id)
      ? String(selectedCategory._id || selectedCategory.id)
      : null;

    let productosVisibles = [];
    if (selectedCategoryId && selectedCategory) {
      productosVisibles = allMenus
        .filter(menu => {
          const menuCategoryIds = Array.isArray(menu.category_ids) ? menu.category_ids.map(String) : [];
          if (!menuCategoryIds.length) return false;
          if (!menuCategoryIds.includes(selectedCategoryId)) return false;
          if (!menu.location_ids || menu.location_ids.length === 0) return true;
          if (!menu.location_ids.map(String).includes(selectedLocationId)) return false;
          if (Array.isArray(menu.restriccion) && menu.restriccion.length > 0) {
            return menu.restriccion.includes('dinein');
          }
          return true;
        })
        .map(menu => {
          const optionIds = Array.isArray(menu.option_ids) ? menu.option_ids.map(String) : [];
          const options = optionIds
            .map(optId => (menuOptions || []).find(opt => String(opt.id) === optId || String(opt._id) === optId))
            .filter(Boolean);
          return { ...menu, options };
        });
    }

    const allLocationMenus = allMenus
      .filter(menu => {
        if (!menu.location_ids || menu.location_ids.length === 0) return true;
        if (!menu.location_ids.map(String).includes(selectedLocationId)) return false;
        if (Array.isArray(menu.restriccion) && menu.restriccion.length > 0) {
          return menu.restriccion.includes('dinein');
        }
        return true;
      })
      .map(menu => {
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

  return {
    data,
    locations: allLocations,
    isLoading,
    error,
    refresh: () => fetchData(true),
    selectedLocation,
    setSelectedLocation: handleLocationChange,
    selectedCategory,
    setSelectedCategory: handleCategoryChange,
  };
};

export default useRecipes;
