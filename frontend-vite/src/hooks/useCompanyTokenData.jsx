import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { useBalance } from 'wagmi';
import { getContractInstance } from '../context/contracts';
import { useTranslation } from 'react-i18next';
import appData from '../utils/appData.jsx';

/**
 * Interface for token data
 * @typedef {Object} TokenData
 * @property {string} tokenAddress - Governance token address
 * @property {string} tokenSymbol - Token symbol
 * @property {bigint} totalSupply - Total token supply
 * @property {number} immediateUnlockPercent - Immediate unlock percentage
 * @property {bigint} immediateTokens - Immediate tokens available
 * @property {bigint} requiredTokens - Required tokens for presale
 * @property {bigint} beneficiaryBalance - Beneficiary wallet balance
 * @property {bigint} userBalance - User's wallet balance
 * @property {boolean} hasSufficientTokens - Whether beneficiary has enough tokens
 * @property {number} liquidityPercent - Liquidity pool percentage
 * @property {boolean} isLoading - Loading state
 * @property {string} error - Error message
 */

/**
 * Hook to fetch company token data
 * @param {Object} appState - Application state
 * @param {number} companyId - Company ID
 * @param {string} beneficiaryWallet - Beneficiary wallet address
 * @param {number} presalePercent - Presale percentage
 * @param {string} userWallet - User's wallet address
 * @returns {TokenData & { refetch: Function }}
 */
export function useCompanyTokenData(appState, companyId, beneficiaryWallet, presalePercent, userWallet) {
  const { t } = useTranslation();
  const [tokenData, setTokenData] = useState({
    tokenAddress: '',
    tokenSymbol: '',
    totalSupply: BigInt(0),
    immediateUnlockPercent: 0,
    immediateTokens: BigInt(0),
    requiredTokens: BigInt(0),
    beneficiaryBalance: BigInt(0),
    userBalance: BigInt(0),
    hasSufficientTokens: false,
    liquidityPercent: 20, // Fallback
    isLoading: false,
    error: '',
  });
  const hasFetched = useRef(false);

  const fetchTokenData = useCallback(async () => {
    if (
      !appState?.provider ||
      companyId == null||
      !ethers.isAddress(userWallet) ||
      !presalePercent
    ) {
      setTokenData((prev) => ({
        ...prev,
        error: t('presale.errors.invalid_input'),
        isLoading: false,
      }));
      return;
    }
    setTokenData((prev) => ({ ...prev, isLoading: true, error: '' }));

    try {
      const multiToken = getContractInstance('VanellixCompanyMultiToken', appState.provider);
      const companyData = await multiToken.getCompanyData(companyId);
      const tokenAddress = companyData.governanceTokenProxy;
      if (!ethers.isAddress(tokenAddress)) {
        throw new Error(t('presale.errors.invalid_token_address'));
      }

      const tokenFactory = getContractInstance('VanellixTokenFactory', appState.provider);
      const tokenId = await tokenFactory.getTokenIdByCompanyId(companyId);
      const [, vestingConfig] = await tokenFactory.getTokenBasicData(tokenId);
      const vdomToken = getContractInstance('WrappedToken', appState.provider, tokenAddress);
      const totalSupply = BigInt((await vdomToken.totalSupply()).toString());
      const tokenSymbol = await vdomToken.symbol();

      // Use immediateUnlockPercent from vestingConfig (index 8)
      const immediateUnlockPercent = Number(vestingConfig[8]);
      const immediateTokens = (totalSupply * BigInt(immediateUnlockPercent)) / BigInt(100);
      const effectivePresalePercent = 80;
      const requiredTokens = (immediateTokens * BigInt(effectivePresalePercent)) / BigInt(100);

      let liquidityPercent = 20; // Fallback
      try {
        const percent = await multiToken.getCompanyLiquidity(companyId);
        liquidityPercent = Number(percent);
      } catch (err) {
        console.warn('Failed to fetch liquidity percent, using fallback:', err);
      }

      setTokenData((prev) => {
        const newData = {
          ...prev,
          tokenAddress,
          tokenSymbol,
          totalSupply,
          immediateUnlockPercent,
          immediateTokens,
          requiredTokens,
          liquidityPercent,
          isLoading: false,
          error: '',
        };
        return newData;
      });
    } catch (err) {
      setTokenData((prev) => {
        const errorData = {
          ...prev,
          isLoading: false,
          error: err.message || t('presale.errors.fetch_token_data'),
        };
        appState?.setError(err.message || 'Error fetching token data');
        return errorData;
      });
    }
  }, [appState, companyId, userWallet, presalePercent, t]);

  // Fetch token data only once
  if (!hasFetched.current) {
    hasFetched.current = true;
    fetchTokenData();
  }

  // Fetch balances only when beneficiaryWallet is valid
  const isValidBeneficiaryWallet = ethers.isAddress(beneficiaryWallet);

  const beneficiaryBalanceResult = useBalance({
    address: isValidBeneficiaryWallet ? beneficiaryWallet : undefined,
    token: ethers.isAddress(tokenData.tokenAddress) ? tokenData.tokenAddress : undefined,
    enabled: isValidBeneficiaryWallet && !!tokenData.tokenAddress,
    watch: true,
  });

  const userBalanceResult = useBalance({
    address: ethers.isAddress(userWallet) ? userWallet : undefined,
    token: ethers.isAddress(tokenData.tokenAddress) ? tokenData.tokenAddress : undefined,
    enabled: !!userWallet && !!tokenData.tokenAddress,
    watch: true,
  });

  const beneficiaryBalance = beneficiaryBalanceResult.data?.value
    ? BigInt(beneficiaryBalanceResult.data.value.toString())
    : BigInt(0);
  const userBalance = userBalanceResult.data?.value
    ? BigInt(userBalanceResult.data.value.toString())
    : BigInt(0);
  const hasSufficientTokens = beneficiaryBalance >= tokenData.requiredTokens;

  return {
    ...tokenData,
    beneficiaryBalance,
    userBalance,
    hasSufficientTokens,
    beneficiaryBalanceLoading: beneficiaryBalanceResult.isLoading,
    userBalanceLoading: userBalanceResult.isLoading,
    beneficiaryBalanceError: beneficiaryBalanceResult.error?.message,
    userBalanceError: userBalanceResult.error?.message,
    refetch: fetchTokenData,
  };
}

// Nueva función para obtener los tokens de plataforma desde la API (sin afectar el hook principal)
export async function fetchPlatformTokensFromApi() {
  try {
    return await appData.fetchPlatformTokens();
  } catch (err) {
    appState?.setError(err.message || 'Error fetching platform tokens');
  }
}

export default useCompanyTokenData;