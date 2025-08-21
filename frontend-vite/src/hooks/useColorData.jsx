// /Users/vanellix/piccola_italia_web3/piccola_italia_web3/frontend-vite/src/hooks/useColorData.jsx
import { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { fetchColorLevels } from '../utils/clubNonnaData.jsx';

const useColorData = (appState) => {
  const { t } = useTranslation();
  const [colorLevels, setColorLevels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchColorLevelsApi = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetchColorLevels();
      setColorLevels(response);
      setIsLoading(false);
    } catch (err) {
      setError(t('admin.color_levels.error_fetching'));
      setIsLoading(false);
      toast.error(t('admin.color_levels.error_fetching'));
    }
  }, [t]);

  const createColorLevel = useCallback(async (levelData) => {
    if (!appState.accessToken || !appState.account) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await axios.post('/api/color_levels', levelData, {
        headers: { 'X-Wallet-Address': appState.account, Authorization: `Bearer ${appState.accessToken}` },
      });
      setColorLevels((prev) => [...prev, response.data]);
      setSuccess(t('admin.color_levels.created'));
      setIsLoading(false);
      toast.success(t('admin.color_levels.created'));
    } catch (err) {
      setError(t('admin.color_levels.error_creating'));
      setIsLoading(false);
      toast.error(t('admin.color_levels.error_creating'));
    }
  }, [appState.accessToken, appState.account, t]);

  const updateColorLevel = useCallback(async (levelId, levelData) => {
    if (!appState.accessToken || !appState.account) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await axios.put(`/api/color_levels/${levelId}`, levelData, {
        headers: { 'X-Wallet-Address': appState.account, Authorization: `Bearer ${appState.accessToken}` },
      });
      setColorLevels((prev) => prev.map((level) => (level.id === levelId ? response.data : level)));
      setSuccess(t('admin.color_levels.updated'));
      setIsLoading(false);
      toast.success(t('admin.color_levels.updated'));
    } catch (err) {
      setError(t('admin.color_levels.error_updating'));
      setIsLoading(false);
      toast.error(t('admin.color_levels.error_updating'));
    }
  }, [appState.accessToken, appState.account, t]);

  const deleteColorLevel = useCallback(async (levelId) => {
    if (!appState.accessToken || !appState.account) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await axios.delete(`/api/color_levels/${levelId}`, {
        headers: { 'X-Wallet-Address': appState.account, Authorization: `Bearer ${appState.accessToken}` },
      });
      setColorLevels((prev) => prev.filter((level) => level.id !== levelId));
      setSuccess(t('admin.color_levels.deleted'));
      setIsLoading(false);
      toast.success(t('admin.color_levels.deleted'));
    } catch (err) {
      setError(t('admin.color_levels.error_deleting'));
      setIsLoading(false);
      toast.error(t('admin.color_levels.error_deleting'));
    }
  }, [appState.accessToken, appState.account, t]);

  return {
    colorLevels,
    isLoading,
    error,
    success,
    fetchColorLevelsApi,
    createColorLevel,
    updateColorLevel,
    deleteColorLevel,
  };
};

export default useColorData;