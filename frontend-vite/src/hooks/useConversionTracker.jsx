import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useBalance } from 'wagmi';
import { fetchPlatformTokensFromApi } from './useCompanyTokenData';

const dripAccountId = import.meta.env.VITE_DRIP_ACCOUNT_ID;
const dripApiKey = import.meta.env.VITE_DRIP_API_KEY;
const dripUserAgent = import.meta.env.VITE_DRIP_USER_AGENT;

const useConversionTracker = ({ profile, accessToken, account, isAuthenticated, provider, companyId }) => {
  const [dripEnabled, setDripEnabled] = useState(false);
  const [platformTokens, setPlatformTokens] = useState([]);
  const [tokenBalances, setTokenBalances] = useState({});

  // Chequear si Drip está habilitado basado en profile
  useEffect(() => {
    if (profile && profile.subscribe_news !== undefined) {
      setDripEnabled(profile.subscribe_news);
    }
  }, [profile]);

  // Fetch platform tokens and filter by companyId
  useEffect(() => {
    const fetchAndFilterPlatformTokens = async () => {
      if (dripEnabled && account && companyId) {
        try {
          const tokensResponse = await fetchPlatformTokensFromApi();
          const tokens = tokensResponse.all_token_addresses;
          setPlatformTokens(tokens);
        } catch (error) {
          console.error('Error fetching platform tokens:', error);
        }
      }
    };
    fetchAndFilterPlatformTokens();
  }, [dripEnabled, account, companyId]);

  // Fetch balances for each platform token
  useEffect(() => {
    const fetchBalances = async () => {
      if (platformTokens.length > 0 && account && provider) {
        const balances = {};
        for (const token of platformTokens) {
          if (!token.address) {
            console.warn('Token sin address, se omite:', token);
            continue;
          }
          try {
            let balance;
            let decimals;
            if (token.type === 'native') {
              balance = await provider.getBalance(account);
              decimals = 18; // Native tokens like ETH typically have 18 decimals
            } else {
              // ERC20 balanceOf and decimals
              const erc20 = new ethers.Contract(token.address, [
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)'
              ], provider);
              balance = await erc20.balanceOf(account);
              const dec = await erc20.decimals();
              decimals = Number(dec);
            }
            balances[token.address] = { raw: balance?.toString() || '0', decimals };
          } catch (error) {
            console.error('Error fetching balance/decimals for', token.address, error);
            balances[token.address] = { raw: '0', decimals: 18 }; // Fallback to 18 if error
          }
        }
        setTokenBalances(balances);
      }
    };
    fetchBalances();
  }, [platformTokens, account, provider]);

  // Inyectar script de Drip si está habilitado
  useEffect(() => {
    if (dripEnabled) {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = `//tag.getdrip.com/${dripAccountId}.js`;
      document.head.appendChild(script);

      window._dcq = window._dcq || [];
      window._dcs = window._dcs || {};
      window._dcs.account = dripAccountId;

      return () => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };
    }
  }, [dripEnabled]);

  // Identificar al usuario y enviar balances como custom fields
  useEffect(() => {
    if (dripEnabled && isAuthenticated && profile?.email && window._dcq) {
      const customFields = {
        birthdate: String(profile.birthdate || ''),
        instagram: String(profile.instagram || ''),
        twitter: String(profile.twitter || ''),
        discord: String(profile.discord || ''),
        bio: String(profile.bio || ''),
        favorite_location: String(profile.favorite_location || ''),
      };

      // Add balances for each token (e.g., utility_balance, governance_balance)
      Object.keys(tokenBalances).forEach(addr => {
        const token = platformTokens.find(t => t.address === addr);
        if (token) {
          const { raw, decimals } = tokenBalances[addr];
          const formattedBalance = ethers.formatUnits(raw, decimals);
          customFields[`${token.symbol}_balance`] = formattedBalance;
        }
      });
      // Serializa cualquier valor object en customFields para evitar [object Object]
      Object.keys(customFields).forEach(key => {
        const value = customFields[key];
        if (typeof value === 'object' && value !== null) {
          customFields[key] = JSON.stringify(value);
        }
      });

      const dripPayload = {
        email: profile.email,
        first_name: profile.name?.split(' ')[0] || '',
        last_name: profile.name?.split(' ').slice(1).join(' ') || '',
        visitor_uuid: profile?.email ? ethers.sha256(ethers.toUtf8Bytes(profile.email)) : undefined,
        tags: ['Tokens'],
        ...customFields,
      };
      window._dcq.push([
        'identify',
        dripPayload,
      ]);
    }
  }, [dripEnabled, profile, isAuthenticated, tokenBalances, platformTokens]);

  // Función para agregar un tag en Drip
  const addDripTag = useCallback(
    (tag) => {
      if (!dripEnabled || !window._dcq || !profile?.email) return;
      window._dcq.push([
        'tag',
        {
          email: profile.email,
          tag: tag,
        },
      ]);
    },
    [dripEnabled, profile]
  );

  // Función para remover un tag en Drip
  const removeDripTag = useCallback(
    (tag) => {
      if (!dripEnabled || !window._dcq || !profile?.email) return;
      window._dcq.push([
        'untag',
        {
          email: profile.email,
          tag: tag,
        },
      ]);
    },
    [dripEnabled, profile]
  );

  // Función de segmentación: actualiza el segmento del usuario en Drip
  const updateDripSegmentation = useCallback(
    (segment, value = true) => {
      if (!dripEnabled || !window._dcq || !profile?.email) return;

      window._dcq.push([
        'identify',
        {
          email: profile.email,
          [segment]: value,
        },
      ]);

      if (value) {
        addDripTag(segment);
      } else {
        removeDripTag(segment);
      }
    },
    [dripEnabled, profile, addDripTag, removeDripTag]
  );

  // Funciones de tracking de Drip (adaptadas: removemos checkout/purchase, agregamos claim y burn)
  const trackDripEvent = useCallback(
    (eventName, params) => {
      if (!dripEnabled || !window._dcq) return;
      window._dcq.push(['track', eventName, {
        ...params,
        currency: 'CLP', // Asumiendo moneda; ajusta si es necesario
      }]);
    },
    [dripEnabled]
  );

  // Evento para vista de menú/producto
  const trackViewItem = useCallback(
    (menuId, menuName, menuPrice) => {
      trackDripEvent('Viewed a Product', {
        product_id: menuId,
        name: menuName,
        price: menuPrice,
        email: profile?.email || '',
        first_name: profile?.name?.split(' ')[0] || '',
        last_name: profile?.name?.split(' ').slice(1).join(' ') || '',
      });
    },
    [trackDripEvent, profile]
  );

  // Nuevo: Trackear reclamo de promoción
  const trackClaimPromotion = useCallback(
    (promotionId, promotionName, claimedAmount, menuItemSku = null) => {
      trackDripEvent('Claimed Promotion', {
        promotion_id: promotionId,
        promotion_name: promotionName,
        claimed_amount: claimedAmount,
        menu_item_sku: menuItemSku,
        email: profile?.email || '',
        first_name: profile?.name?.split(' ')[0] || '',
        last_name: profile?.name?.split(' ').slice(1).join(' ') || '',
      });
      updateDripSegmentation('PromotionClaimer', true);
    },
    [trackDripEvent, profile, updateDripSegmentation]
  );

  // Nuevo: Trackear quemado de tokens
  const trackBurnTokens = useCallback(
    (tokenAddress, burnedAmount, promotionId = null) => {
      trackDripEvent('Burned Tokens', {
        token_address: tokenAddress,
        burned_amount: burnedAmount,
        promotion_id: promotionId,
        email: profile?.email || '',
        first_name: profile?.name?.split(' ')[0] || '',
        last_name: profile?.name?.split(' ').slice(1).join(' ') || '',
      });
      updateDripSegmentation('TokenBurner', true);
    },
    [trackDripEvent, profile, updateDripSegmentation]
  );

  // Tracker para stake
  const trackStake = useCallback(
    (amount, tokenAddress, companyId, poolAddress = null) => {
      trackDripEvent('Stake', {
        amount,
        token_address: tokenAddress,
        company_id: companyId,
        pool_address: poolAddress,
        email: profile?.email || '',
        first_name: profile?.name?.split(' ')[0] || '',
        last_name: profile?.name?.split(' ').slice(1).join(' ') || '',
      });
      updateDripSegmentation('Staker', true);
    },
    [trackDripEvent, profile, updateDripSegmentation]
  );

  // Tracker para unstake
  const trackUnstake = useCallback(
    (amount, tokenAddress, companyId, poolAddress = null) => {
      trackDripEvent('Unstake', {
        amount,
        token_address: tokenAddress,
        company_id: companyId,
        pool_address: poolAddress,
        email: profile?.email || '',
        first_name: profile?.name?.split(' ')[0] || '',
        last_name: profile?.name?.split(' ').slice(1).join(' ') || '',
      });
      updateDripSegmentation('Unstaker', true);
    },
    [trackDripEvent, profile, updateDripSegmentation]
  );

  // Tracker para claim de stake
  const trackClaimStake = useCallback(
    (rewardAmount, tokenAddress, companyId, poolAddress = null) => {
      trackDripEvent('Claim Stake Reward', {
        reward_amount: rewardAmount,
        token_address: tokenAddress,
        company_id: companyId,
        pool_address: poolAddress,
        email: profile?.email || '',
        first_name: profile?.name?.split(' ')[0] || '',
        last_name: profile?.name?.split(' ').slice(1).join(' ') || '',
      });
      updateDripSegmentation('StakeClaimer', true);
    },
    [trackDripEvent, profile, updateDripSegmentation]
  );

  return {
    dripEnabled,
    setDripEnabled,
    trackDripEvent,
    trackViewItem,
    trackClaimPromotion,
    trackBurnTokens,
    updateDripSegmentation,
    addDripTag,
    removeDripTag,
    trackStake,
    trackUnstake,
    trackClaimStake,
  };

};

export default useConversionTracker;