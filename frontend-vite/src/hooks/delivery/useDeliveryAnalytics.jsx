import { useState, useCallback, useMemo } from 'react';
import { fetchAdvancedAnalytics } from '../../utils/deliveryData';

export const useDeliveryAnalytics = ({ appState, locationId }) => {
  const [data, setData] = useState({ heatmap: [], sales_by_hour: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Date range filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadAnalytics = useCallback(async () => {
    if (!appState?.token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdvancedAnalytics({
        token: appState.token,
        walletAddress: appState.account,
        locationId,
        dateFrom: dateFrom ? `${dateFrom}T00:00:00` : undefined,
        dateTo: dateTo ? `${dateTo}T23:59:59` : undefined,
      });
      if (res.success) {
        setData({
          heatmap: res.heatmap || [],
          sales_by_hour: res.sales_by_hour || []
        });
      } else {
        throw new Error(res.message || 'Error fetching analytics');
      }
    } catch (err) {
      setError(err.message);
      console.error('Analytics Error:', err);
    } finally {
      setLoading(false);
    }
  }, [appState?.token, appState?.account, locationId, dateFrom, dateTo]);

  return {
    data,
    loading,
    error,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    loadAnalytics
  };
};
