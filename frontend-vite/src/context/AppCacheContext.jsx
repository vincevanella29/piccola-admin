import React, { createContext, useContext, useRef, useState, useCallback } from 'react';

const CACHE_KEY = 'app_global_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hora por defecto

const AppCacheContext = createContext();

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Limpia expirados
    const now = Date.now();
    Object.keys(parsed).forEach(key => {
      if (!parsed[key] || !parsed[key].ts || (now - parsed[key].ts) > (parsed[key].ttl || CACHE_TTL)) {
        delete parsed[key];
      }
    });
    return parsed;
  } catch {
    return {};
  }
}

function saveCache(cache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function AppCacheProvider({ children }) {
  const [cache, setCache] = useState(loadCache());
  const memCache = useRef(cache);

  // Guarda en memoria y localStorage
  const setCacheForKey = useCallback((key, data, ttl = CACHE_TTL) => {
    const newCache = { ...memCache.current, [key]: { data, ts: Date.now(), ttl } };
    memCache.current = newCache;
    setCache(newCache);
    saveCache(newCache);
  }, []);

  const getCacheForKey = useCallback((key) => {
    const entry = memCache.current[key];
    if (!entry) return null;
    if ((Date.now() - entry.ts) > (entry.ttl || CACHE_TTL)) return null;
    return entry.data;
  }, []);

  const clearCache = useCallback(() => {
    memCache.current = {};
    setCache({});
    saveCache({});
  }, []);

  const removeCacheKey = useCallback((key) => {
    const newCache = { ...memCache.current };
    delete newCache[key];
    memCache.current = newCache;
    setCache(newCache);
    saveCache(newCache);
  }, []);

  return (
    <AppCacheContext.Provider value={{ getCacheForKey, setCacheForKey, clearCache, removeCacheKey, cache }}>
      {children}
    </AppCacheContext.Provider>
  );
}

export function useAppCache() {
  return useContext(AppCacheContext);
}
