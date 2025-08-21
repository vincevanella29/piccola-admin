import { useState, useEffect, useCallback } from 'react';  // Add useCallback for memo
import { erc20Abi } from 'viem';
import { ethers } from 'ethers';
import { fetchActivePromotions, claimPromotion, getMyCoupons, getBurnedBalance } from '../utils/promotionsData';
import { getContractInstance } from '../context/contracts';

const ERC20_ABI = erc20Abi;

export function usePromotionClient(appState, t) {
  const [promotions, setPromotions] = useState([]);
  const [myCoupons, setMyCoupons] = useState([]);
  const [totalCoupons, setTotalCoupons] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCoupons, setIsLoadingCoupons] = useState(false);
  const [error, setError] = useState(null);
  const [errorCoupons, setErrorCoupons] = useState(null);
  const [tokenDecimals, setTokenDecimals] = useState({});
  const [burnBalances, setBurnBalances] = useState({});
  const [tokenBalances, setTokenBalances] = useState({}); 
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
  }, [tokenBalances, burnBalances]);  // Depend on balances for recompute

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

      if (tokenAddresses.length > 0 && walletAddress && token && provider) {
        await Promise.all([
          fetchBurnBalances(tokenAddresses, walletAddress, token),
          fetchTokenBalances(tokenAddresses, walletAddress, provider),
        ]);
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

      const sortedPromos = computePromotionStatuses(processedPromos, appState.profile);
      setPromotions(sortedPromos);
    } catch (err) {
      setError(err.message || t('promotion.error_fetching'));
      appState.setError(err.message || t('promotion.error_fetching'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (promotions.length > 0 && appState.profile) {
      const sortedPromos = computePromotionStatuses(promotions, appState.profile);
      setPromotions(sortedPromos);
    }
  }, [appState.profile, burnBalances, tokenBalances, computePromotionStatuses]);

  const fetchMyCoupons = async ({ page = 1, limit = 20, status = '' }) => {
    setIsLoadingCoupons(true);
    setErrorCoupons(null);
    try {
      const walletAddress = appState?.account;
      const token = appState?.token;
      if (!walletAddress || !token) {
        appState.setError(t('wallet.connect_wallet'));
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
      if (!appState?.signTxData || !appState?.sendTx) {
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
          // Refresh balance after burn
          await refreshBurnBalance(tokenAddress);
          burnedResp = burnBalances[tokenAddress];
          saldo = BigInt(burnedResp.saldo);
          if (saldo < required) {
            appState.setError(t('promotion.insufficient_burn_after_burn'));
            return;
          }
        }
      }

      // Proceed with claim
      const plainData = `Claim promotion ${promotion.name} ID: ${promotion.id}`;
      const signature = await appState.signTxData(plainData);
      if (!signature) {
        appState.setError(t('wallet.signature_rejected'));
        return;
      }
      const response = await claimPromotion({
        walletAddress: wallet,
        token,
        promotionId: promotion.id,
        signature,
        plainData,
        menu_item_sku: menuItemSku,
      });
      if (response.tx) {
        const hash = await appState.sendTx(response.tx, appState);
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
        console.log('Evento de claim enviado a Conversion Tracker:', {
          promotionId: promotion.id,
          promotionName: promotion.name,
          claimedAmount: response.coupon_code,
          menuItemSku,
          claimedAt: new Date().toISOString(),
        });
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
      if (!appState?.sendTx) {
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
        const plainApprove = `Approve tokens for burn\nPromotion: ${promotion.name} ID: ${promotion.id}\nToken: ${tokenAddress}\nAmount: ${ethers.formatUnits(amountToBurnBase, decimals)}\nSpender: ${redemptionContract.target}`;
        const approveSignature = await appState.signTxData(plainApprove);
        if (!approveSignature) {
          appState.setError(t('wallet.signature_rejected'));
          return;
        }
        const approveTx = await tokenContract.approve.populateTransaction(redemptionContract.target, amountToBurnBase);
        const approveHash = await appState.sendTx(approveTx, appState);
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

      const plainBurn = t('promotion.burn_signature', {
        promotion: promotion.name,
        id: promotion.id,
        token: tokenAddress,
        amount: ethers.formatUnits(amountToBurnBase, decimals),
        companyId: companyId,
      });
      const burnSignature = await appState.signTxData(plainBurn);
      if (!burnSignature) {
        appState.setError(t('wallet.signature_rejected'));
        return;
      }
      const burnTx = await redemptionContract.burnTokens.populateTransaction(
        companyId,
        tokenAddress,
        amountToBurnBase,
        `Burn for promotion ${promotion.name} ID: ${promotion.id}`
      );
      const burnHash = await appState.sendTx(burnTx, appState);
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
        console.log('Evento de burn enviado a Conversion Tracker:', {
          tokenAddress,
          burnedAmount: ethers.formatUnits(amountToBurnBase, decimals),
          promotionId: promotion.id,
          burnedAt: new Date().toISOString(),
        });
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
    getBurnedBalance: getBurnedBalanceUser,
    refreshBurnBalance,
    claim,
    burn,
    burnBalances,
    tokenBalances,
  };
}

export default usePromotionClient;