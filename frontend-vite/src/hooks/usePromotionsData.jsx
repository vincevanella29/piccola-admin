// src/hooks/usePromotionsData.jsx
import { useState, useEffect } from 'react';
import { fetchLocations, fetchMenus } from '../utils/clubNonnaData';

// Configuración del caché
const CACHE_KEY = 'promotions_data';
const CACHE_TTL = 3600000; // 1 hora en milisegundos

// Helper para obtener datos del caché
const getCachedData = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const { timestamp, data } = JSON.parse(cached);
    const now = Date.now();
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

const usePromotionsData = (appState) => {
  const [locations, setLocations] = useState([]);
  const [menus, setMenus] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cachedData = getCachedData();
      if (cachedData && cachedData.locations?.length && cachedData.menus?.length) {
        setLocations(cachedData.locations);
        setMenus(cachedData.menus);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    try {
      const walletAddress = appState?.account;
      const token = appState?.token;

      const [locationsRes, menusRes] = await Promise.all([
        fetchLocations(),
        fetchMenus(walletAddress, token),
      ]);

      if (locationsRes.error) appState.setError(`Error en locales: ${locationsRes.error}`);
      if (menusRes.error) appState.setError(`Error en menús: ${menusRes.error}`);

      const locationsData = Array.isArray(locationsRes) ? locationsRes : locationsRes.locations || [];
      const menusData = Array.isArray(menusRes) 
        ? menusRes.map((menu) => ({
            ...menu,
            codigo: String(menu.codigo || menu._id),
          }))
        : menusRes.menus?.map((menu) => ({
            ...menu,
            codigo: String(menu.codigo || menu._id),
          })) || [];

      const categoriesData = menusRes.categories || [];

      setLocations(locationsData);
      setMenus(menusData);
      setCategories(categoriesData);

      saveToCache({
        locations: locationsData,
        menus: menusData,
        categories: categoriesData,
      });
    } catch (e) {
      appState.setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    locations,
    menus,
    categories,
    isLoading,
    error,
    refresh: () => fetchData(true),
  };
};

export default usePromotionsData;