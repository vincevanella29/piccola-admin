// src/hooks/marketing/useMarketingAudience.jsx
import { useState, useCallback } from 'react';
import appData from '../../utils/appData.jsx';

const useMarketingAudience = ({ token, account }) => {
  const [audience, setAudience] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const args = { accessToken: token, wallet: account };

  const fetchAudience = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await appData.marketingGetAudience(args);
      setAudience(res?.audience || []);
      setTotal(res?.total || 0);
      return res;
    } catch (e) {
      console.error('[useMarketingAudience] fetchAudience:', e);
    } finally {
      setIsLoading(false);
    }
  }, [token, account]);

  const addLead = useCallback(async (data) => {
    setIsLoading(true);
    try {
      const res = await appData.marketingAddLead({ ...args, data });
      await fetchAudience();
      return res;
    } finally {
      setIsLoading(false);
    }
  }, [token, account, fetchAudience]);

  // Derived audiences for specific channels
  const whatsappEligible = audience.filter(a => a.phone && a.phone.length > 8);
  const pushEligible = audience.filter(a => a.fcm_tokens && a.fcm_tokens.length > 0);
  const emailEligible = audience.filter(a => a.email && a.email.includes('@'));

  return {
    audience,
    total,
    whatsappEligible,
    pushEligible,
    emailEligible,
    fetchAudience,
    addLead,
    isLoading,
  };
};

export default useMarketingAudience;
