// src/hooks/useWalletBalances.jsx
import { useEffect, useState } from 'react';
import { getBalance } from 'wagmi/actions';
import { useConfig } from 'wagmi';
import { fetchPlatformTokensFromApi } from './useCompanyTokenData.jsx';

export function useWalletBalances(account, isModalOpen, chainId) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const config = useConfig();

  useEffect(() => {
    let mounted = true;

    async function fetchTokens() {
      if (!account || !isModalOpen) {
        if (mounted) {
          setTokens([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const data = await fetchPlatformTokensFromApi();
        if (!mounted) return;

        if (!Array.isArray(data?.all_token_addresses)) {
          console.error('Invalid API response: all_token_addresses is not an array', data);
          setTokens([]);
          setLoading(false);
          return;
        }

        const tokenList = data.all_token_addresses
          .filter((token) => {
            if (!token?.address || typeof token.address !== 'string') {
              console.warn('Skipping invalid token: missing or invalid address', token);
              return false;
            }
            return true;
          })
          .map((token) => ({
            ...token,
            address: token.address.toLowerCase(),
            isNative: token.type === 'native' || token.address.toLowerCase() === '0x0000000000000000000000000000000000001010',
            symbol: token.symbol || 'UNKNOWN',
            name: token.name || 'Unknown Token',
            balance: null,
            decimals: token.decimals || 18,
            loading: true,
            error: null,
          }));

        setTokens(tokenList);
      } catch (err) {
        console.error('Error fetching platform tokens:', err);
        if (mounted) {
          setTokens([]);
          setLoading(false);
        }
      }
    }

    fetchTokens();
    return () => {
      mounted = false;
    };
  }, [account, isModalOpen]);

  useEffect(() => {
    let mounted = true;

    async function fetchAllBalances() {
      if (!account || !isModalOpen || !tokens.length || !config) {
        if (mounted) {
          setTokens([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const results = await Promise.all(
          tokens.map(async (token) => {
            try {
              const balanceData = await getBalance(config, {
                address: account,
                token: token.isNative ? undefined : token.address,
                chainId: Number(chainId),
              });

              return {
                ...token,
                balance: balanceData?.value ? Number(balanceData.value) / 10 ** (balanceData.decimals || 18) : 0,
                decimals: balanceData?.decimals || token.decimals || 18,
                loading: false,
                error: null,
              };
            } catch (err) {
              return {
                ...token,
                balance: 0,
                loading: false,
                error: err?.message || 'Error fetching balance',
              };
            }
          })
        );

        if (mounted) {
          setTokens(results);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching balances:', err);
        if (mounted) {
          setTokens([]);
          setLoading(false);
        }
      }
    }

    if (tokens.length) {
      fetchAllBalances();
    }

    return () => {
      mounted = false;
    };
  }, [account, isModalOpen, chainId, config, tokens.length]);

  return { tokens, loading };
}