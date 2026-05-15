import { useState, useEffect, useCallback } from 'react';
import {
  getCollections as apiGetCollections,
  createEndpoint as apiCreateEndpoint,
  listEndpoints as apiListEndpoints,
  updateEndpoint as apiUpdateEndpoint,
  deleteEndpoint as apiDeleteEndpoint,
} from '../utils/apiEndpoints.jsx';

export function useApiEndpoints(appState, t) {
  const setError = appState?.setError;
  const setSuccess = appState?.setSuccess;
  const wallet = appState?.account;
  const token = appState?.token;

  const [isLoading, setIsLoading] = useState(false);
  const [endpoints, setEndpoints] = useState([]);
  const [collections, setCollections] = useState([]);

  const fetchCollections = useCallback(async () => {
    try {
      if (!wallet || !token) return;
      const data = await apiGetCollections({ token, walletAddress: wallet });
      setCollections(data);
    } catch (err) {
      console.error('Failed to load collections:', err);
    }
  }, [wallet, token]);

  const loadEndpoints = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!wallet || !token) return;
      const data = await apiListEndpoints({ token, walletAddress: wallet });
      setEndpoints(data);
    } catch (err) {
      setError?.(t?.('apikeys.error_list') || 'Error loading endpoints');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [wallet, token, setError, t]);

  const createEndpoint = async (data) => {
    setIsLoading(true);
    try {
      const res = await apiCreateEndpoint({ data, token, walletAddress: wallet });
      setSuccess?.(t?.('apikeys.created_success') || 'Created successfully');
      await loadEndpoints();
      return res;
    } catch (err) {
      setError?.(err.message || 'Error creating endpoint');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateEndpoint = async (slug, data) => {
    setIsLoading(true);
    try {
      const res = await apiUpdateEndpoint({ slug, data, token, walletAddress: wallet });
      setSuccess?.(t?.('apikeys.updated_success') || 'Updated successfully');
      await loadEndpoints();
      return res;
    } catch (err) {
      setError?.(err.message || 'Error updating endpoint');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteEndpoint = async (slug) => {
    setIsLoading(true);
    try {
      await apiDeleteEndpoint({ slug, token, walletAddress: wallet });
      setSuccess?.(t?.('apikeys.deleted_success') || 'Deleted successfully');
      await loadEndpoints();
    } catch (err) {
      setError?.(err.message || 'Error deleting endpoint');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (wallet && token) {
      fetchCollections();
      loadEndpoints();
    }
  }, [wallet, token, fetchCollections, loadEndpoints]);

  return {
    isLoading,
    endpoints,
    collections,
    createEndpoint,
    updateEndpoint,
    deleteEndpoint,
    loadEndpoints,
  };
}
