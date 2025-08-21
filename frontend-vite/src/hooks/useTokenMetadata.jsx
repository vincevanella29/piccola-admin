import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { erc20ABI } from "../context/erc20ABI";

/**
 * useTokenMetadata
 * @param {string} address ERC-20 token address
 * @returns {{ name: string, symbol: string, totalSupply: string, decimals: number, loading: boolean, error: string }}
 */
export function useTokenMetadata(address) {
  const isNativeToken =
    !address ||
    address === "0" ||
    address === "0x0000000000000000000000000000000000000000"
    || address === "0x0000000000000000000000000000000000001010";

  // Always call hooks at the top level
  const [result, setResult] = useState({
    name: '',
    symbol: '',
    totalSupply: '',
    decimals: 18,
    loading: true,
    error: ''
  });

  // Only enable hooks if not native token
  const enabled = Boolean(
    !isNativeToken && address && /^0x[a-fA-F0-9]{40}$/.test(address)
  );

  const nameCall = useReadContract({
    address,
    abi: erc20ABI,
    functionName: 'name',
    enabled,
  });
  const symbolCall = useReadContract({
    address,
    abi: erc20ABI,
    functionName: 'symbol',
    enabled,
  });
  const totalSupplyCall = useReadContract({
    address,
    abi: erc20ABI,
    functionName: 'totalSupply',
    enabled,
  });
  const decimalsCall = useReadContract({
    address,
    abi: erc20ABI,
    functionName: 'decimals',
    enabled,
  });

  useEffect(() => {
    if (!enabled) {
      setResult({
        name: '',
        symbol: '',
        totalSupply: '',
        decimals: 18,
        loading: false,
        error: ''
      });
      return;
    }
    if (
      nameCall.isLoading ||
      symbolCall.isLoading ||
      totalSupplyCall.isLoading ||
      decimalsCall.isLoading
    ) {
      setResult(r => ({ ...r, loading: true, error: '' }));
      return;
    }
    if (
      nameCall.error ||
      symbolCall.error ||
      totalSupplyCall.error ||
      decimalsCall.error
    ) {
      setResult({
        name: '',
        symbol: '',
        totalSupply: '',
        decimals: 18,
        loading: false,
        error: '',
      });
      return;
    }
    setResult({
      name: nameCall.data || '',
      symbol: symbolCall.data || '',
      totalSupply: totalSupplyCall.data ? totalSupplyCall.data.toString() : '',
      decimals:
        typeof decimalsCall.data === 'number'
          ? decimalsCall.data
          : decimalsCall.data
          ? Number(decimalsCall.data)
          : 18,
      loading: false,
      error: '',
    });
  }, [
    enabled,
    nameCall.data,
    symbolCall.data,
    totalSupplyCall.data,
    decimalsCall.data,
    nameCall.isLoading,
    symbolCall.isLoading,
    totalSupplyCall.isLoading,
    decimalsCall.isLoading,
    nameCall.error,
    symbolCall.error,
    totalSupplyCall.error,
    decimalsCall.error
  ]);

  // Native token: always return immediately
  if (isNativeToken) {
    return {
      name: "MATIC", // O "ETH" según la red
      symbol: "MATIC",
      totalSupply: "",
      decimals: 18,
      loading: false,
      error: "",
    };
  }

  return result;
}