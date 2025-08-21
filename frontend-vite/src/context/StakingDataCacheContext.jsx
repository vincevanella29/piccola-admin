import React, { createContext, useContext, useRef, useState, useCallback } from 'react';

const CACHE_KEY = 'staking_company_pools_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

const StakingDataCacheContext = createContext();

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Limpia expirados
    const now = Date.now();
    Object.keys(parsed).forEach(key => {
      if (!parsed[key] || !parsed[key].ts || (now - parsed[key].ts) > CACHE_TTL) {
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

export function StakingDataCacheProvider({ children }) {
  const [cache, setCache] = useState(loadCache());
  const memCache = useRef(cache);

  // Guarda en memoria y localStorage
  const setCacheForKey = useCallback((key, data) => {
    const newCache = { ...memCache.current, [key]: { data, ts: Date.now() } };
    memCache.current = newCache;
    setCache(newCache);
    saveCache(newCache);
  }, []);

  const getCacheForKey = useCallback((key) => {
    const entry = memCache.current[key];
    if (!entry) return null;
    if ((Date.now() - entry.ts) > CACHE_TTL) return null;
    return entry.data;
  }, []);

  const clearCache = useCallback(() => {
    memCache.current = {};
    setCache({});
    saveCache({});
  }, []);

  return (
    <StakingDataCacheContext.Provider value={{ getCacheForKey, setCacheForKey, clearCache }}>
      {children}
    </StakingDataCacheContext.Provider>
  );
}

export function useStakingDataCache() {
  return useContext(StakingDataCacheContext);
}
