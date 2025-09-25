import axios from 'axios';

let API_URL;
if (import.meta.env.VITE_DEV === 'true' && !window.env?.VITE_API_URL) {
  API_URL = import.meta.env.VITE_API_URL_DEV;
} else {
  API_URL = window.env?.VITE_API_URL || import.meta.env.VITE_API_URL;
}

const api = async ({ method, endpoint, data, params, headers = {}, withCredentials = false, appState = {} }) => {
  try {
    // No enviar headers Authorization ni cookies en preflight OPTIONS
    let safeHeaders = { ...headers };
    let safeWithCredentials = withCredentials;
    if (method.toUpperCase() === 'OPTIONS') {
      // Elimina Authorization y cualquier header custom que cause CORS
      delete safeHeaders['Authorization'];
      safeWithCredentials = false;
    }
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        ...(data ? { 'Content-Type': 'application/json' } : {}),
        ...safeHeaders,
      },
      ...(data ? { data } : {}),
      ...(params ? { params } : {}),
      withCredentials: safeWithCredentials,
    };
    const response = await axios(config);
    return response.data;
  } catch (err) {
    const message = err.response?.data?.detail || err.message;
    throw new Error(message);
  }
};

export const apiform = async ({ method, endpoint, data, params, headers = {}, withCredentials = false, appState = {} }) => {
  try {
    let safeHeaders = { ...headers };
    let safeWithCredentials = withCredentials;
    if (method.toUpperCase() === 'OPTIONS') {
      delete safeHeaders['Authorization'];
      safeWithCredentials = false;
    }
    // Elimina Content-Type para que el navegador lo setee con boundary
    if ('Content-Type' in safeHeaders) delete safeHeaders['Content-Type'];
    // Agrega params al endpoint si existen
    let url = `${API_URL}${endpoint}`;
    if (params && typeof params === 'object') {
      const usp = new URLSearchParams(params);
      url += (url.includes('?') ? '&' : '?') + usp.toString();
    }
    const fetchOptions = {
      method,
      headers: safeHeaders,
      body: data,
      credentials: safeWithCredentials ? 'include' : 'same-origin',
    };
    const res = await fetch(url, fetchOptions);
    if (!res.ok) {
      let errMsg = await res.text();
      try { errMsg = (await res.json()).detail || errMsg; } catch {}
      throw new Error(errMsg);
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    } else {
      return await res.text();
    }
  } catch (err) {
    throw new Error(err.message);
  }
};

// Fetch binary (Blob) responses against the same API base URL, with headers/credentials
export const apiFetchBinary = async ({ method = 'GET', endpoint, headers = {}, withCredentials = false }) => {
  try {
    const url = `${API_URL}${endpoint}`;
    const res = await fetch(url, {
      method,
      headers,
      credentials: withCredentials ? 'include' : 'same-origin',
    });
    if (!res.ok) {
      let errMsg = await res.text();
      try { errMsg = (await res.json()).detail || errMsg; } catch {}
      throw new Error(errMsg || `HTTP ${res.status}`);
    }
    return await res.blob();
  } catch (err) {
    throw new Error(err.message || 'apiFetchBinary failed');
  }
};

export default api;