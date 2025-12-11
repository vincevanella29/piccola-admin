import { useState, useEffect, useCallback } from 'react';  // Add useCallback for memo
import { erc20Abi } from 'viem';
import { ethers } from 'ethers';
import { fetchActivePromotions, claimPromotion, getMyCoupons, getBurnedBalance, fetchMeritSegments } from '../utils/promotionsData';
import { getContractInstance } from '../context/contracts';

const ERC20_ABI = erc20Abi;

export function usePromotionClient(appState, t) {
  const [promotions, setPromotions] = useState([]);           // Promotions with computed metStatus
  const [rawPromotions, setRawPromotions] = useState([]);     // Promotions as returned (after amount unit conversion)
  const [myCoupons, setMyCoupons] = useState([]);
  const [totalCoupons, setTotalCoupons] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCoupons, setIsLoadingCoupons] = useState(false);
  const [error, setError] = useState(null);
  const [errorCoupons, setErrorCoupons] = useState(null);
  const [tokenDecimals, setTokenDecimals] = useState({});
  const [burnBalances, setBurnBalances] = useState({});
  const [tokenBalances, setTokenBalances] = useState({}); 
  const [meritSegments, setMeritSegments] = useState([]);
  const [meritBalances, setMeritBalances] = useState({}); // { [segment_token_id]: { base: string, human: number } }
  const companyId = appState.companyId;

  function expandScientificNotation(numStr) {
    if (!/e/i.test(numStr)) return numStr;
    let [base, exp] = numStr.toLowerCase().split('e');
    exp = parseInt(exp);
    base = base.replace('.', '');
    const zeros = Math.max(0, exp - (base.length - 1));
    return base + '0'.repeat(zeros);
  }

  const fromBaseUnits = (amount, decimals) => {
    try {
      let strAmount = amount.toString();
      if (/e/i.test(strAmount)) {
        strAmount = expandScientificNotation(strAmount);
      }
      return ethers.formatUnits(strAmount, decimals);
    } catch (error) {
      console.error('Error converting from base units:', error);
      return '0';
    }
  };

  const fetchMeritBalances = async (segmentTokenIds, walletAddress, provider) => {
    const ids = Array.from(new Set((segmentTokenIds || []).filter((id) => id !== null && id !== undefined)));
    if (!walletAddress || !provider || ids.length === 0) return;
    try {
      const meritContract = getContractInstance('GlobalMeritocracy', provider);
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const balanceBase = await meritContract.balanceOf(walletAddress, id);
            const baseStr = balanceBase?.toString ? balanceBase.toString() : String(balanceBase ?? '0');
            const human = toMeritHuman(baseStr);
            return { id, base: baseStr, human };
          } catch (e) {
            console.error('Error fetching merit balance for segment', id, e);
            return { id, base: '0', human: 0 };
          }
        })
      );
      const map = {};
      results.forEach(({ id, base, human }) => {
        map[id] = { base, human };
      });
      setMeritBalances((prev) => ({ ...prev, ...map }));
    } catch (err) {
      console.error('Error fetching merit balances:', err);
      appState.setError(err.message || t('promotion.error_fetching_balance'));
    }
  };

  const fetchTokenBalances = async (tokenAddresses, walletAddress, provider) => {
    if (!provider || !walletAddress) return;  // Skip if not connected
    try {
      const promises = tokenAddresses.map(async (tokenAddress) => {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const [balance, decimals] = await Promise.all([
          tokenContract.balanceOf(walletAddress),
          tokenContract.decimals()
        ]);
        const humanBalance = Number(fromBaseUnits(balance, decimals));
        return { tokenAddress, balance: humanBalance, decimals };
      });
      const results = await Promise.all(promises);
      const newTokenBalances = {};
      const newTokenDecimals = {};
      results.forEach(({ tokenAddress, balance, decimals }) => {
        newTokenBalances[tokenAddress] = balance;
        newTokenDecimals[tokenAddress] = decimals;
      });
      setTokenBalances((prev) => ({ ...prev, ...newTokenBalances }));
      setTokenDecimals((prev) => ({ ...prev, ...newTokenDecimals }));
    } catch (err) {
      console.error('Error fetching token balances:', err);
      appState.setError(err.message || t('promotion.error_fetching_balance'));
    }
  };

  const MERIT_DECIMALS = 18; // Méritos usan 18 decimales on-chain

  const toMeritHuman = (raw) => {
    if (raw === undefined || raw === null) return 0;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return n / 10 ** MERIT_DECIMALS;
  };

  const checkRuleMet = (rule, profile) => {  // Now synchronous
    const isHold = rule.rule_type === 'hold_tokens';
    const isBurn = rule.rule_type === 'burn_tokens';
    const isBirthday = rule.rule_type === 'birthday';
    const isCompleteProfile = rule.rule_type === 'require_complete_profile';
    const isPublicProfile = rule.rule_type === 'require_public_profile';
    const isSubscribeNews = rule.rule_type === 'require_subscribe_news';
    const isRequireBirthdate = rule.rule_type === 'require_birthdate';
    const isFavoriteLocation = rule.rule_type === 'require_favorite_location';
    const isMinLikedProducts = rule.rule_type === 'require_min_liked_products';
    const isMeritMinWallet = rule.rule_type === 'merit_min_wallet';
    const isMeritRanking = rule.rule_type === 'merit_rule_fulfilled';
    const required = Number(rule.amount || 0);
    const minCount = Number(rule.min_count || 0);

    if (isHold) {
      const humanBalance = tokenBalances[rule.token_address] || 0;
      return humanBalance >= required;
    }

    if (isBurn) {
      const burned = Number(burnBalances[rule.token_address]?.saldo_human || 0);
      const humanBalance = tokenBalances[rule.token_address] || 0;
      return burned >= required || humanBalance >= required;
    }

    if (isCompleteProfile) {
      const requiredFields = ['name', 'email', 'birthdate'];
      return requiredFields.every((field) => profile?.[field]?.trim());
    }

    if (isPublicProfile) {
      return profile?.public_profile === true;
    }

    if (isSubscribeNews) {
      return profile?.email?.trim() && profile?.subscribe_news === true;
    }

    if (isBirthday || isRequireBirthdate) {
      return typeof profile?.birthdate === 'string' && profile.birthdate.trim() !== '';
    }

    if (isFavoriteLocation) {
      return profile?.favorite_location?.trim();
    }

    if (isMinLikedProducts) {
      const likedCount = profile?.liked_products
        ? Object.keys(profile.liked_products).filter((key) => profile.liked_products[key]).length
        : 0;
      return likedCount >= minCount;
    }

    if (isMeritMinWallet) {
      const segmentId = rule.segment_token_id;
      const entry = meritBalances?.[segmentId];
      const onchainHuman = entry ? Number(entry.human || 0) : 0;

      // amount viene en base units (18 decimales); lo mostramos y comparamos en puntos humanos
      const requiredBase = rule.amount || 0;
      const requiredHuman = toMeritHuman(requiredBase);
      const met = onchainHuman >= requiredHuman;

      // Guardamos estos valores en el propio rule para que el UI los pueda mostrar tal cual
      // sin depender de timing de estados externos.
      rule._meritBalanceHuman = onchainHuman;
      rule._meritRequiredHuman = requiredHuman;

      return met;
    }

    if (isMeritRanking) {
      const meritProgress = rule.merit_progress || {};
      const status = meritProgress.status || 'unknown';
      const met = status === 'fulfilled';

      // Solo marcamos como cumplida la regla si el backend ya la considera fulfilled.
      return met;
    }

    return false;
  };

  const computePromotionStatuses = useCallback((promos, profile) => {  // Sync, memoized
    return promos.map((promo) => {
      const alreadyHasBirthday = (promo.rules || []).some(r => r.rule_type === 'birthday');
      let rulesWithBirthday;
      if ((promo.coupon_validity?.validity === 'birthday' || promo.is_birthday_coupon) && !alreadyHasBirthday) {
        rulesWithBirthday = [
          {
            rule_type: 'birthday',
            birthday_valid_days: promo.coupon_validity?.birthday_valid_days ?? 7,
          },
          ...(promo.rules || [])
        ];
      } else {
        rulesWithBirthday = [...(promo.rules || [])];
      }

      const metStatus = {};
      rulesWithBirthday.forEach((rule, i) => {
        metStatus[i] = checkRuleMet(rule, profile);
      });

      const allRequirementsMet = rulesWithBirthday.length > 0 ? Object.values(metStatus).every((m) => m) : true;

      return {
        ...promo,
        rules: rulesWithBirthday,
        metStatus,
        allRequirementsMet,
        rulesMetCount: Object.values(metStatus).filter((m) => m).length,
        totalRules: rulesWithBirthday.length,
      };
    }).sort((a, b) => {
      if (a.allRequirementsMet !== b.allRequirementsMet) {
        return a.allRequirementsMet ? -1 : 1;
      }
      return new Date(a.claim_end) - new Date(b.claim_end);
    });
  }, [tokenBalances, burnBalances, meritBalances]);  // Recompute when any balance set changes

  // Mantener promotions derivadas en sync con rawPromotions + balances + profile
  useEffect(() => {
    if (!rawPromotions || rawPromotions.length === 0) return;
    const profile = appState.profile;
    const sorted = computePromotionStatuses(rawPromotions, profile);
    setPromotions(sorted);
  }, [rawPromotions, computePromotionStatuses, appState.profile]);

  const fetchBurnBalances = async (tokenAddresses, walletAddress, token) => {
    if (!walletAddress || !token) return;  // Skip if not connected
    try {
      const promises = tokenAddresses.map(async (tokenAddress) => {
        const response = await getBurnedBalance({ walletAddress, tokenAddress, token });
        return { tokenAddress, balance: response };
      });
      const results = await Promise.all(promises);
      const newBurnBalances = results.reduce((acc, { tokenAddress, balance }) => {
        acc[tokenAddress] = balance;
        return acc;
      }, {});
      setBurnBalances((prev) => ({ ...prev, ...newBurnBalances }));
    } catch (err) {
      console.error('Error fetching burn balances:', err);
      appState.setError(err.message || t('promotion.error_fetching_burned_balance'));
    }
  };

  const refreshBurnBalance = async (tokenAddress = null) => {
    const walletAddress = appState?.account;
    const token = appState?.token;
    if (!walletAddress || !token) {
      appState.setError(t('wallet.connect_wallet'));
      return;
    }

    const tokenAddresses = tokenAddress
      ? [tokenAddress]
      : [...new Set(promotions.flatMap((promo) =>
          promo.rules
            .filter((rule) => rule.rule_type === 'burn_tokens' && rule.token_address)
            .map((rule) => rule.token_address)
        ))];

    await fetchBurnBalances(tokenAddresses, walletAddress, token);
  };

  const loadMeritSegments = async () => {
    try {
      const walletAddress = appState?.account;
      const token = appState?.token;
      if (!walletAddress || !token) return;
      const response = await fetchMeritSegments({ walletAddress, token });
      const segments = response?.segments || [];
      setMeritSegments(segments);
    } catch (err) {
      console.error('Error fetching merit segments:', err);
      appState.setError(err.message || t('promotion.error_fetching'));
    }
  };

  const fetchPromos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const walletAddress = appState?.account;
      const token = appState?.token;
      const provider = appState?.provider;
      const response = await fetchActivePromotions({ walletAddress, token });

      const tokenAddresses = [...new Set(
        response.promotions.flatMap((promo) =>
          promo.rules
            .filter((rule) => (rule.rule_type === 'burn_tokens' || rule.rule_type === 'hold_tokens') && rule.token_address)
            .map((rule) => rule.token_address)
        )
      )];

      const meritSegmentIds = [...new Set(
        response.promotions.flatMap((promo) =>
          (promo.rules || [])
            .filter((rule) => rule.rule_type === 'merit_min_wallet' && rule.segment_token_id !== undefined && rule.segment_token_id !== null)
            .map((rule) => rule.segment_token_id)
        )
      )];

      if (walletAddress && token && provider) {
        const promises = [];
        if (tokenAddresses.length > 0) {
          promises.push(fetchBurnBalances(tokenAddresses, walletAddress, token));
          promises.push(fetchTokenBalances(tokenAddresses, walletAddress, provider));
        }
        promises.push(loadMeritSegments());
        if (meritSegmentIds.length > 0) {
          promises.push(fetchMeritBalances(meritSegmentIds, walletAddress, provider));
        }
        await Promise.all(promises);
      }

      const processedPromos = await Promise.all(
        response.promotions.map(async (promo) => {
          const processedRules = promo.rules.map((rule) => {
            if (rule.token_address && rule.amount) {
              const dec = tokenDecimals[rule.token_address] || 18;  // Use pre-fetched, default 18
              const humanAmount = fromBaseUnits(rule.amount, dec);
              return { ...rule, amount: humanAmount };
            }
            return rule;
          });
          return { ...promo, rules: processedRules };
        })
      );
      // Guardamos las promos procesadas y dejamos que el useEffect + computePromotionStatuses
      // apliquen el estado de reglas usando los últimos balances / profile.
      setRawPromotions(processedPromos);
    } catch (err) {
      setError(err.message || t('promotion.error_fetching'));
      appState.setError(err.message || t('promotion.error_fetching'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyCoupons = async ({ page = 1, limit = 20, status = '' }) => {
    setIsLoadingCoupons(true);
    setErrorCoupons(null);
    try {
      const walletAddress = appState?.account;
      const token = appState?.token;
      if (!walletAddress || !token) {
        appState.setError(t('wallet.connect_wallet'));
        setMyCoupons([]);
        setTotalCoupons(0);
        return;
      }
      const response = await getMyCoupons({ walletAddress, token, page, limit, status });
      setMyCoupons(response.coupons);
      setTotalCoupons(response.total);
    } catch (err) {
      setErrorCoupons(err.message || t('promotion.error_fetching_coupons'));
      appState.setError(err.message || t('promotion.error_fetching_coupons'));
    } finally {
      setIsLoadingCoupons(false);
    }
  };

  const getBurnedBalanceUser = async ({ walletAddress, tokenAddress }) => {
    if (burnBalances[tokenAddress]) {
      return burnBalances[tokenAddress];
    }
    try {
      const response = await getBurnedBalance({ walletAddress, tokenAddress, token: appState.token });
      setBurnBalances((prev) => ({ ...prev, [tokenAddress]: response }));
      return response;
    } catch (err) {
      appState.setError(err.message || t('promotion.error_fetching_burned_balance'));
      return null;
    }
  };

  const claim = async ({ promotion, menuItemSku }) => {
    appState.setSuccess(t('wallet.processing_transaction'));
    setError(null);
    try {
      const provider = appState?.provider;
      const wallet = appState?.account;
      const token = appState?.token;
      if (!wallet || !token || !provider) {
        appState.setError(t('wallet.connect_wallet'));
        return;
      }
      if (!appState?.sendTx && !appState?.customSendTransaction) {
        appState.setError(t('wallet.error_transfer'));
        return;
      }

      // Check if burn is required upfront
      const burnRule = promotion.rules.find((rule) => rule.rule_type === 'burn_tokens');
      if (burnRule) {
        const tokenAddress = burnRule.token_address;
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const decimals = await tokenContract.decimals();
        const required = ethers.parseUnits(burnRule.amount.toString(), decimals);

        // Use cached burn balance
        let burnedResp = burnBalances[tokenAddress];
        if (!burnedResp) {
          burnedResp = await getBurnedBalanceUser({ walletAddress: wallet, tokenAddress });
          if (!burnedResp) {
            appState.setError(t('promotion.error_fetching_burned_balance'));
            return;
          }
        }
        let saldo = BigInt(burnedResp.saldo);
        if (saldo < required) {
          // Burn the difference
          const burnResult = await burn({ promotion });
          if (!burnResult || burnResult.success !== true) {
            appState.setError(t('promotion.error_burning'));
            return;
          }
          // No revalidamos inmediatamente el saldo quemado aquí porque
          // el backend (Mongo) puede tardar unos segundos en reflejar
          // el burn on-chain. Confiamos en que el backend valide.
        }

        if (appState?.signTxData) {
          const signatureMessage = JSON.stringify({
            type: 'PROMOTION_CLAIM',
            promotionId: promotion.id,
            promotionName: promotion.name,
            walletAddress: wallet,
            timestamp: Date.now(),
          });

          const signatureUiOptions = {
            title: t('promotion.claim_title', { name: promotion.name }),
            description: t('signature.no_fees'),
            buttonText: t('signature.sign_continue'),
          };

          try {
            await appState.signTxData(signatureMessage, signatureUiOptions);
          } catch (sigErr) {
            appState.setError(t('signature.error'));
            return;
          }
        }
      } else {
        // No burn rule: still require a simple fake signature before pure claim
        if (appState?.signTxData) {
          const signatureMessage = JSON.stringify({
            type: 'PROMOTION_CLAIM',
            promotionId: promotion.id,
            promotionName: promotion.name,
            walletAddress: wallet,
            timestamp: Date.now(),
          });

          const signatureUiOptions = {
            title: t('promotion.claim_title', { name: promotion.name }),
            description: t('signature.no_fees'),
            buttonText: t('signature.sign_continue'),
          };

          try {
            await appState.signTxData(signatureMessage, signatureUiOptions);
          } catch (sigErr) {
            appState.setError(t('signature.error'));
            return;
          }
        }
      }

      const response = await claimPromotion({
        walletAddress: wallet,
        token,
        promotionId: promotion.id,
        menu_item_sku: menuItemSku,
      });
      if (response.tx) {
        const txUiOptions = {
          transactionInfo: {
            title: t('promotion.claim_title', { name: promotion.name }),
            action: t('promotion.claim_action', 'Reclamar promoción'),
            summary: t('promotion.claim_summary', {
              defaultValue: 'Vas a reclamar la promoción "{{name}}" (ID {{id}}).',
              name: promotion.name,
              id: promotion.id,
            }),
          },
        };

        let hash;
        if (appState.customSendTransaction) {
          hash = await appState.customSendTransaction(response.tx, txUiOptions);
        } else {
          hash = await appState.sendTx(response.tx, txUiOptions);
        }
        if (!hash) {
          appState.setError(t('wallet.error_transfer'));
          return;
        }
        appState.setSuccess(t('wallet.transaction_success', { hash }), hash, `${appState.blockExplorer}/tx/${hash}`);
      } else {
        appState.setSuccess(`${t('promotion.claim_success')} Coupon: ${response.coupon_code}`);
      }

      // Track claim event
      if (appState?.trackClaimPromotion) {
        appState.trackClaimPromotion(
          promotion.id,
          promotion.name,
          response.coupon_code,
          menuItemSku
        );
      }

      // Refresh promotions and burn balances
      await fetchPromos();
      return response;
    } catch (err) {
      setError(err.message || t('promotion.error_claiming'));
      appState.setError(err.message || t('promotion.error_claiming'));
    }
  };

  const burn = async ({ promotion }) => {
    appState.setSuccess(t('wallet.processing_transaction'));
    setError(null);
    try {
      const provider = appState?.provider;
      const wallet = appState?.account;
      if (!wallet || !provider) {
        appState.setError(t('wallet.connect_wallet'));
        return;
      }
      if (!appState?.sendTx && !appState?.customSendTransaction) {
        appState.setError(t('wallet.error_transfer'));
        return;
      }
      const burnRule = promotion.rules.find((rule) => rule.rule_type === 'burn_tokens');
      if (!burnRule) {
        appState.setError('No burn rule found');
        return;
      }
      const tokenAddress = burnRule.token_address;
      const redemptionContract = getContractInstance('VanellixRedemption', provider);
      if (!wallet) appState.setError('Wallet address missing');
      if (!tokenAddress) appState.setError('Token address missing');
      if (!redemptionContract?.target) appState.setError('Redemption contract address missing');

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const decimals = await tokenContract.decimals();
      const required = ethers.parseUnits(burnRule.amount.toString(), decimals);

      // Use cached burn balance
      let burnedResp = burnBalances[tokenAddress];
      if (!burnedResp) {
        burnedResp = await getBurnedBalanceUser({ walletAddress: wallet, tokenAddress });
        if (!burnedResp) {
          appState.setError('Error obteniendo saldo de puntos quemados');
          return;
        }
      }
      let saldo = BigInt(burnedResp.saldo);
      const amountToBurnBase = saldo < required ? required - saldo : 0n;
      if (amountToBurnBase === 0n) {
        return { success: true };
      }

      const balance = await tokenContract.balanceOf(wallet);
      if (balance < amountToBurnBase) {
        appState.setError(t('wallet.insufficient_balance'));
        return;
      }

      let allowance = await tokenContract.allowance(wallet, redemptionContract.target);
      if (allowance < amountToBurnBase) {
        const approveTx = await tokenContract.approve.populateTransaction(
          redemptionContract.target,
          amountToBurnBase
        );

        const approveUiOptions = {
          transactionInfo: {
            title: t('promotion.approve_title', { name: promotion.name }),
            action: t('promotion.approve_action', 'Aprobar tokens para quema'),
            tokenInfo: {
              spender: redemptionContract.target,
              tokenAddress,
              network: t('transaction.default_network_name'),
              estimatedFee: t('transaction.default_estimated_fee'),
            },
            summary: t('promotion.approve_summary', {
              defaultValue: 'Aprobar hasta {{amount}} tokens para ser quemados en la promoción "{{name}}".',
              amount: ethers.formatUnits(amountToBurnBase, decimals),
              name: promotion.name,
            }),
            dataSummary: {
              type: 'PROMOTION_BURN_APPROVAL',
              title: t('promotion.approve_title', { name: promotion.name }),
              data: {
                promotionId: promotion.id,
                companyId,
                tokenAddress,
                amount: ethers.formatUnits(amountToBurnBase, decimals),
                walletAddress: wallet,
              },
            },
          },
        };

        const approveHash = appState.customSendTransaction
          ? await appState.customSendTransaction(approveTx, approveUiOptions)
          : await appState.sendTx(approveTx, approveUiOptions);
        if (!approveHash) {
          appState.setError(t('wallet.error_transfer'));
        }
        if (!appState.isPrivyWalletActive) {
          await provider.waitForTransaction(approveHash);
        }
        allowance = await tokenContract.allowance(wallet, redemptionContract.target);
        if (allowance < amountToBurnBase) {
          appState.setError('Allowance still insufficient after approval');
          return;
        }
      }

      const burnTx = await redemptionContract.burnTokens.populateTransaction(
        companyId,
        tokenAddress,
        amountToBurnBase,
        `Burn for promotion ${promotion.name} ID: ${promotion.id}`
      );
      const burnUiOptions = {
        transactionInfo: {
          title: t('promotion.burn_title', { name: promotion.name }),
          action: t('promotion.burn_action', 'Quemar tokens para promoción'),
          tokenInfo: {
            spender: redemptionContract.target,
            tokenAddress,
            network: t('transaction.default_network_name'),
            estimatedFee: t('transaction.default_estimated_fee'),
          },
          summary: t('promotion.burn_summary', {
            defaultValue: 'Vas a quemar {{amount}} tokens para participar en la promoción "{{name}}".',
            amount: ethers.formatUnits(amountToBurnBase, decimals),
            name: promotion.name,
          }),
        },
      };

      const burnHash = appState.customSendTransaction
        ? await appState.customSendTransaction(burnTx, burnUiOptions)
        : await appState.sendTx(burnTx, burnUiOptions);
      if (!burnHash) {
        appState.setError(t('wallet.error_transfer'));
        return;
      }
      appState.setSuccess(t('wallet.transaction_success', { hash: burnHash }), burnHash, `${appState.blockExplorer}/tx/${burnHash}`);
      if (!appState.isPrivyWalletActive) {
        await provider.waitForTransaction(burnHash);
      }

      // Track burn event
      if (appState?.trackBurnTokens) {
        appState.trackBurnTokens(
          tokenAddress,
          ethers.formatUnits(amountToBurnBase, decimals),
          promotion.id
        );
      }

      // Refresh burn balance after successful burn
      await refreshBurnBalance(tokenAddress);
      return { success: true };
    } catch (err) {
      setError(err.message || t('promotion.error_burning'));
      appState.setError(err.message || t('promotion.error_burning'));
      throw err;
    }
  };
  
  return {
    promotions,
    myCoupons,
    totalCoupons,
    isLoading,
    isLoadingCoupons,
    error,
    errorCoupons,
    fetchPromos,
    fetchMyCoupons,
    refreshBurnBalance,
    claim,
    burn,
    burnBalances,
    tokenBalances,
    meritSegments,
    meritBalances,
    loadMeritSegments,
  };
}

export default usePromotionClient;