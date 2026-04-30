// src/hooks/usePromotionAdmin.jsx
import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { createPromotion, updatePromotion, fetchAllPromotions, reactivateCoupon, redeemCoupon, fetchCoupons, fetchApiToken as fetchApiTokenApi, generateApiToken as generateApiTokenApi, fetchMeritSegments } from '../utils/promotionsData';
import { fetchPlatformTokensFromApi } from './useCompanyTokenData';
import { useTokenMetadata } from './useTokenMetadata';
import { listMeritRules as apiListMeritRules } from '../utils/gamification.jsx';

// Utility to expand scientific notation to full decimal string
function expandScientificNotation(numStr) {
  if (!/e/i.test(numStr)) return numStr;
  let [base, exp] = numStr.toLowerCase().split('e');
  exp = parseInt(exp);
  base = base.replace('.', '');
  const zeros = Math.max(0, exp - (base.length - 1));
  return base + '0'.repeat(zeros);
}

// Utility to validate and convert human-readable amount to base units
const toBaseUnits = (amount, decimals) => {
  try {
    // Ensure amount is a string to avoid JavaScript float precision issues
    let normalized = amount.toString().trim();
    if (!/^-?\d*\.?\d*$/.test(normalized)) {
      throw new Error('Invalid number format');
    }
    if (/e/i.test(normalized)) {
      normalized = expandScientificNotation(normalized);
    }
    // Use ethers.parseUnits to convert to base units
    const baseUnits = ethers.parseUnits(normalized, decimals).toString();
    return baseUnits;
  } catch (error) {
    console.error('Error converting to base units:', error);
    throw new Error(`Invalid amount: ${amount}`);
  }
};

// Utility to convert base units to human-readable amount
const fromBaseUnits = (amount, decimals) => {
  if (amount === null || amount === undefined || amount === '') {
    return '0';
  }
  try {
    let strAmount = amount.toString();
    if (/e/i.test(strAmount)) {
      strAmount = expandScientificNotation(strAmount);
    }
    const humanReadable = ethers.formatUnits(strAmount, decimals);
    return humanReadable;
  } catch (error) {
    console.error('Error converting from base units:', error);
    return '0';
  }
};

export function usePromotionAdmin(appState, t) {
  const [error, setError] = useState(null);
  const [platformTokens, setPlatformTokens] = useState([]);
  const [tokenDecimals, setTokenDecimals] = useState({});
  const [meritSegments, setMeritSegments] = useState([]);
  const [meritRules, setMeritRules] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const wallet = appState?.account;
  const token = appState?.token;
  const hasFetchedTokens = useRef(false);

  // Load tokens
  const refetchTokens = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const tokens = await fetchPlatformTokensFromApi();
      setPlatformTokens(tokens?.all_token_addresses || []);
      // Cargar también segmentos de meritocracia permitidos para la compañía
      const meritRes = await fetchMeritSegments({ walletAddress: wallet, token });
      const segments = meritRes?.segments || [];
      setMeritSegments(segments);

      // Cargar reglas de meritocracia (gamification_meritocracy_rules) para usarlas en el admin de promociones
      try {
        const resRules = await apiListMeritRules({ onlyActive: true, walletAddress: wallet, token });
        const items = resRules?.data?.rules || resRules?.rules || [];
        setMeritRules(items);
      } catch (rulesErr) {
        console.error('Error fetching merit rules:', rulesErr);
      }
    } catch (err) {
      console.error('Error fetching platform tokens:', err);
      setError(t('promotion.error_fetch_tokens', { message: err.message }));
    } finally {
      setIsLoading(false);
    }
  };

  // Load token metadata
  useEffect(() => {
    let cancelled = false;
    async function fetchMetadatas() {
      if (!platformTokens.length) {
        setTokenDecimals({});
        return;
      }
      const metadatas = await Promise.all(
        platformTokens.map(async (token) => {
          try {
            const { decimals, loading, error } = useTokenMetadata(token.address);
            if (!loading && !error && decimals !== undefined) {
              return { address: token.address, decimals };
            }
            return { address: token.address, decimals: token.decimals ?? 18 };
          } catch (e) {
            return { address: token.address, decimals: token.decimals ?? 18 };
          }
        })
      );
      if (cancelled) return;
      const decimalsMap = {};
      metadatas.forEach((meta) => {
        decimalsMap[meta.address] = meta.decimals;
      });
      setTokenDecimals(decimalsMap);
    }
    fetchMetadatas();
    return () => {
      cancelled = true;
    };
  }, [platformTokens]);


  // Load all promotions with filters and pagination
  const refetchAllPromotions = async ({ page = 1,
    limit = 20,
    query = '',
    status = 'all',
    start_date = '',
    end_date = ''
  } = {}) => {  // <--- Added = {} here
    if (!wallet || !token) {
      setError(t('promotion.connect_wallet'));
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAllPromotions({
        walletAddress: wallet,
        token,
        page,
        limit,
        query,
        status,
        start_date,
        end_date,
      });
      // Convert rules.amount from base units to human-readable SOLO para reglas de tokens
      const convertedData = (data.promotions || []).map((promo) => ({
        ...promo,
        rules: (promo.rules || []).map((rule) => {
          if ((rule.rule_type === 'hold_tokens' || rule.rule_type === 'burn_tokens') && rule.token_address) {
            return {
              ...rule,
              amount: fromBaseUnits(rule.amount, tokenDecimals[rule.token_address] || 18),
            };
          }
          return rule;
        }),
      }));
      return { promotions: convertedData, total: data.total };
    } catch (err) {
      setError(t('promotion.error_fetch_all', { message: err.message }));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Load coupons with filters
  const refetchCoupons = async ({ page = 1,
    limit = 20,
    walletFilter = '',
    promotion = '',
    start_date = '',
    end_date = '',
    status = ''
  } = {}) => {  // <--- Added = {} here
    if (!wallet || !token) {
      setError(t('wallet.connect_wallet'));
      return { coupons: [], total: 0 };
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCoupons({
        walletAddress: wallet,
        token,
        page,
        limit,
        wallet: walletFilter,
        promotion,
        start_date,
        end_date,
        status,
      });
      // Convert points_used from base units to human-readable
      const convertedCoupons = data?.coupons?.map((coupon) => ({
        ...coupon,
        points_used: coupon.points_used
          ? fromBaseUnits(coupon.points_used, tokenDecimals[coupon.points_token_address] || 18)
          : 0,
      })) || [];
      setCoupons(convertedCoupons);
      return { coupons: convertedCoupons, total: data?.total || 0 };
    } catch (err) {
      setError(t('promotion.error_fetch_coupons', { message: err.message }));
      return { coupons: [], total: 0 };
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch API token
  const fetchApiToken = async () => {
    if (!wallet || !token) {
      setError(t('wallet.connect_wallet'));
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchApiTokenApi({
        walletAddress: wallet,
        token,
      });
      return data;
    } catch (err) {
      setError(t('promotion.error_fetch_token', { message: err.message }));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Generate API token
  const generateApiToken = async ({ signature, plain_data, duration }) => {
    if (!wallet || !token) {
      setError(t('wallet.connect_wallet'));
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await generateApiTokenApi({
        walletAddress: wallet,
        token,
        signature,
        plain_data,
        duration,
      });
      appState.setSuccess(t('promotion.api_generated'));
      return data;
    } catch (err) {
      setError(t('promotion.error_generating_api', { message: err.message }));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Create a promotion
  const create = async ({ promotionData }) => {
    setError(null);
    try {
      if (!wallet) {
        setError(t('wallet.connect_wallet'));
        return;
      }
      // Convert rules.amount to base units before sending
      const convertedData = {
        ...promotionData,
        rules: promotionData.rules.map((rule) => {
          if ((rule.rule_type === 'hold_tokens' || rule.rule_type === 'burn_tokens') && rule.token_address) {
            const decimals = tokenDecimals[rule.token_address] || 18;
            return {
              ...rule,
              amount: toBaseUnits(rule.amount, decimals),
            };
          }
          return rule;
        }),
      };
      const response = await createPromotion({
        walletAddress: wallet,
        token,
        promotionData: convertedData,
      });
      appState.setSuccess(t('promotion.created_success', { name: promotionData.name }));
      return response;
    } catch (err) {
      setError(t('promotion.error_create', { message: err.message }));
      throw err;
    }
  };

  // Update a promotion
  const update = async ({ promotionId, promotionData }) => {
    setError(null);
    try {
      if (!wallet) {
        setError(t('wallet.connect_wallet'));
        return;
      }
      // Convert rules.amount to base units before sending
      const convertedData = {
        ...promotionData,
        rules: promotionData.rules.map((rule) => {
          if ((rule.rule_type === 'hold_tokens' || rule.rule_type === 'burn_tokens') && rule.token_address) {
            const decimals = tokenDecimals[rule.token_address] || 18;
            return {
              ...rule,
              amount: toBaseUnits(rule.amount, decimals),
            };
          }
          return rule;
        }),
      };
      const response = await updatePromotion({
        walletAddress: wallet,
        token,
        promotionId,
        promotionData: convertedData,
      });
      appState.setSuccess(t('promotion.updated_success', { name: promotionData.name }));
      await refetchAllPromotions();
      return response;
    } catch (err) {
      setError(t('promotion.error_update', { message: err.message }));
      throw err;
    }
  };

  // Reactivate a coupon
  const reactivate = async ({ couponCode }) => {
    setError(null);
    try {
      if (!wallet) {
        setError(t('wallet.connect_wallet'));
        return;
      }
      const response = await reactivateCoupon({
        walletAddress: wallet,
        token,
        couponCode,
      });
      appState.setSuccess(t('promotion.coupon_reactivated', { coupon: couponCode }));
      await refetchCoupons();
      return response;
    } catch (err) {
      setError(t('promotion.error_reactivate', { message: err.message }));
      throw err;
    }
  };

  // Redeem a coupon
  const redeem = async ({ couponCode }) => {
    setError(null);
    try {
      if (!wallet) {
        setError(t('wallet.connect_wallet'));
        return;
      }
      const response = await redeemCoupon({
        walletAddress: wallet,
        token,
        couponCode,
      });
      appState.setSuccess(`Coupon ${couponCode} canjeado bloqueado correctamente.`);
      await refetchCoupons();
      return response;
    } catch (err) {
      setError(`Error canjeando cupón: ${err.message}`);
      throw err;
    }
  };

  // Load initial data
  useEffect(() => {
    if (appState?.isWalletDataReady && !hasFetchedTokens.current) {
      hasFetchedTokens.current = true;
      refetchTokens();
    }
  }, [appState?.isWalletDataReady]);

  return {
    error,
    isLoading,
    promotions,
    coupons,
    create,
    update,
    reactivate,
    redeem,
    refetchAllPromotions,
    refetchCoupons,
    fetchApiToken,
    generateApiToken,
    platformTokens,
    tokenDecimals,
    meritSegments,
    meritRules,
    refetchTokens,
  };
}

export default usePromotionAdmin;