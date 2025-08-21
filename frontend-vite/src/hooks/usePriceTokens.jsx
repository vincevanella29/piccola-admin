// src/hooks/usePriceTokens.jsx
import { useState, useCallback } from 'react';

/**
 * Hook to fetch token prices from CoinGecko for a list of token addresses, called once by WalletModal.
 * @param {string} chain - Network ID (e.g., 'polygon-pos')
 * @returns {{ fetchPrices, prices, loading, error }}
 */
export function usePriceTokens(chain = 'polygon-pos') {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPrices = useCallback(async (contractAddresses) => {
    if (!contractAddresses?.length || !contractAddresses.every(addr => addr && addr.match(/^0x[a-fA-F0-9]{40}$/))) {
      setLoading(false);
      setPrices({});
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);

    const pricesObj = {};
    let anyError = null;

    try {
      // Initialize all addresses with price 0
      contractAddresses.forEach((addr) => {
        pricesObj[addr.toLowerCase()] = { usd: 0 };
      });

      const results = await Promise.all(
        contractAddresses.map(async (address) => {
          try {
            const res = await fetch(`https://api.coingecko.com/api/v3/simple/token_price/${chain}?contract_addresses=${address}&vs_currencies=usd`);
            if (!res.ok) throw new Error(`Error fetching token price for ${address}: ${res.statusText}`);
            const data = await res.json();
            if (!data[address]) throw new Error(`No price data for ${address}`);
            return { address, data };
          } catch (err) {
            return { address, error: err.message };
          }
        })
      );

      results.forEach(({ address, data, error }) => {
        if (error) {
          anyError = error;
          pricesObj[address.toLowerCase()] = { usd: 0 }; // Set 0 for errors
        } else if (data && data[address]) {
          pricesObj[address.toLowerCase()] = data[address];
        }
      });

      setPrices(pricesObj);
      setLoading(false);
      setError(anyError);
    } catch (err) {
      setPrices(pricesObj);
      setLoading(false);
      setError(err.message || 'Error fetching token prices');
    }
  }, [chain]);

  return { fetchPrices, prices, loading, error };
}