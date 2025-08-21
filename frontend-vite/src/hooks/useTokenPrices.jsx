import { useState, useEffect } from 'react';

/**
 * Hook que obtiene precios en tiempo real de CoinGecko para tokens en una red específica.
 * @param {string[]} contractAddresses - Array de contract address en minúsculas
 * @param {string} chain - Ej: 'polygon-pos', 'ethereum', 'arbitrum-one', etc.
 * @returns {{ prices: object, loading: boolean, error: string|null }}
 */
export function useTokenPrices(contractAddresses = [], chain = 'polygon-pos') {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!contractAddresses.length || !contractAddresses.every(addr => addr && addr.match(/^0x[a-fA-F0-9]{40}$/))) {
      setLoading(false);
      setPrices({});
      return;
    }
    setLoading(true);
    setError(null);

    Promise.all(
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
    ).then(results => {
      const pricesObj = {};
      let anyError = null;
      results.forEach(({ address, data, error }) => {
        if (error) {
          anyError = error;
        } else if (data && data[address]) {
          pricesObj[address] = data[address];
        }
      });
      setPrices(pricesObj);
      setLoading(false);
      setError(anyError);
    }).catch(err => {
      setLoading(false);
      setError(err.message);
    });
  }, [contractAddresses, chain]);

  return { prices, loading, error };
}