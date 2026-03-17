/**
 * useAIHistory — Hook para historial de generaciones Aurora por producto
 * pages -> hooks -> utils -> backend
 */
import { useState, useCallback } from 'react';
import * as cartaApi from '../utils/cartaData';

const useAIHistory = ({ token, account, productId }) => {
    const [items, setItems]     = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(null);

    const load = useCallback(async () => {
        if (!productId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await cartaApi.fetchProductAIHistory({ token, account, productId });
            setItems(data?.items || []);
        } catch (e) {
            setError(e?.detail || e?.message || 'Error cargando historial');
        } finally {
            setLoading(false);
        }
    }, [token, account, productId]);

    return { items, loading, error, reload: load };
};

export default useAIHistory;
