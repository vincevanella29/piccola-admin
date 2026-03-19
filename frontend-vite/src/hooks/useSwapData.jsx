import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useBalance } from 'wagmi';
import { ethers, parseUnits } from 'ethers';
import { useTokenMetadata } from '../hooks/useTokenMetadata';
import { debounce } from 'lodash';

export function useSwapData(appState, useSwap) {
  const [showInputDropdown, setShowInputDropdown] = useState(false);
  const [showOutputDropdown, setShowOutputDropdown] = useState(false);
  const inputDropdownRef = useRef(null);
  const outputDropdownRef = useRef(null);
  const inputButtonRef = useRef(null);
  const outputButtonRef = useRef(null);
  const [inputDropdownStyle, setInputDropdownStyle] = useState({});
  const [outputDropdownStyle, setOutputDropdownStyle] = useState({});
  const t = appState?.t;
  const [inputToken, setInputToken] = useState(null);
  const [outputToken, setOutputToken] = useState(null);
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [liquidity, setLiquidity] = useState('');
  const [percentOfPool, setPercentOfPool] = useState('');
  const [warningHighPercent, setWarningHighPercent] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(false); // New state for SwapInfoPanel
  const [error, setError] = useState(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isInputActive, setIsInputActive] = useState(true);
  const { checkAllowance, approve, swap, getPrice } = useSwap;
  const { loading: approveLoading, error: approveError } = approve.state;
  const { loading: swapLoading, error: swapError } = swap.state;

  // Merge hardcoded payment tokens and backend tokens
  const allTokens = useMemo(() => {
    const map = {};
    (Array.isArray(appState.tokens) ? appState.tokens : []).forEach((t) => {
      const addr = t.address.toLowerCase();
      map[addr] = {
        ...map[addr],
        ...t,
        logo: t.logo || t.imagePath || map[addr]?.logo,
        symbol: t.symbol || map[addr]?.symbol,
        name: t.name || map[addr]?.name,
        decimals: t.decimals || map[addr]?.decimals,
        routes: t.routes || [],
      };
    });
    return Object.values(map);
  }, [appState.tokens]);

  // Obtener balances
  const inputBalance = useBalance({
    address: appState.account,
    token: inputToken?.address,
    chainId: appState.chainId,
    enabled: !!appState.account && !!inputToken?.address,
  });

  // Obtener metadatos
  const inputMetadata = useTokenMetadata(inputToken?.address);
  const outputMetadata = useTokenMetadata(outputToken?.address);

  // Helper: find direct pair for selected tokens (if exists)
  const getDirectPair = useCallback((inputToken, outputToken) => {
    if (!inputToken || !outputToken || !Array.isArray(inputToken.routes)) return null;
    return inputToken.routes.find(
      r => r.paymentToken.toLowerCase() === outputToken.address.toLowerCase() && r.exists
    ) || null;
  }, []);

  // Debounced handleAmountChange
  const debouncedGetPrice = useCallback(
    debounce(async (value, isInput, inputToken, outputToken) => {
      setLoadingPrice(true);
      setLoadingInfo(true);
      try {
        const price = await getPrice(
          isInput ? inputToken.address : outputToken.address,
          isInput ? outputToken.address : inputToken.address,
          value,
          isInput
            ? inputMetadata.decimals || inputToken.decimals || 18
            : outputMetadata.decimals || outputToken.decimals || 18,
          isInput
            ? outputMetadata.decimals || outputToken.decimals || 18
            : inputMetadata.decimals || inputToken.decimals || 18
        );
        setLoadingPrice(false);
        setLoadingInfo(false);
        if (price) {
          if (isInput) {
            setOutputAmount(price.amount);
          } else {
            setInputAmount(price.amount);
          }
          setLiquidity(price.liquidity);
          setPercentOfPool(price.percentOfPool);
          setWarningHighPercent(price.warningHighPercent);
          setError('');
        } else {
          setOutputAmount('');
          setInputAmount('');
          setLiquidity('');
          setPercentOfPool('');
          setWarningHighPercent(false);
          setError(t('swap.error_no_liquidity'));
        }
      } catch (err) {
        setLoadingPrice(false);
        setLoadingInfo(false);
        setError(t('swap.error_fetching_price', { message: err.message }));
      }
    }, 2000),
    [inputToken, outputToken, getPrice, inputMetadata.decimals, outputMetadata.decimals, t]
  );

  // Handle amount change with debounce
  const handleAmountChange = useCallback(
    (value, isInput) => {
      setIsInputActive(isInput);
      if (isInput) {
        setInputAmount(value);
      } else {
        setOutputAmount(value);
      }
      if (value && inputToken && outputToken) {
        debouncedGetPrice(value, isInput, inputToken, outputToken);
      } else {
        setLoadingPrice(false);
        setLoadingInfo(false);
        if (isInput) {
          setOutputAmount('');
        } else {
          setInputAmount('');
        }
      }
    },
    [inputToken, outputToken, debouncedGetPrice]
  );

  // Cancel debounce on unmount
  useEffect(() => {
    return () => {
      debouncedGetPrice.cancel();
    };
  }, [debouncedGetPrice]);

  // Verificar allowance
  useEffect(() => {
    const verifyAllowance = async () => {
      if (!appState?.account || !inputAmount || !inputToken) {
        setNeedsApproval(true);
        return;
      }
      try {
        const allowed = await checkAllowance(inputToken, inputAmount, appState.account);
        setNeedsApproval(!allowed);
      } catch (err) {
        setError(t('swap.error_checking_allowance', { message: err.message }));
      }
    };
    verifyAllowance();
  }, [inputAmount, inputToken, appState?.account, checkAllowance, t]);

  // Manejar aprobación
  const handleApprove = async () => {
    try {
      setError(null);
      const amount = parseUnits(inputAmount || '0', inputMetadata.decimals || 18);
      const success = await approve.execute(inputToken, amount);
      if (success) setNeedsApproval(false);
    } catch (err) {
      setError(t('swap.error_approving_token', { symbol: inputToken.symbol, message: err.message }));
    }
  };

  // Manejar swap
  const handleSwap = async () => {
    try {
      setError(null);
      const hash = await swap.execute({
        inputToken,
        outputToken,
        inputAmount,
        outputAmount,
        inputDecimals: inputMetadata.decimals || 18,
        outputDecimals: outputMetadata.decimals || 18,
      });
      if (hash) {
        setInputAmount('');
        setOutputAmount('');
        setLiquidity('');
        setPercentOfPool('');
        setWarningHighPercent(false);
      }
    } catch (err) {
      setError(t('swap.error_swapping', { message: err.message }));
    }
  };

  // Validar input
  const isValidInput = () => {
    const amount = Number(inputAmount);
    const balance = Number(inputBalance.data?.formatted || 0);
    return amount > 0 && amount <= balance && inputToken && outputToken && inputToken.address !== outputToken.address;
  };

  // Calcular mínimo recibido (1% slippage)
  const minReceived = outputAmount && !isNaN(Number(outputAmount))
    ? (Number(outputAmount) * 0.99).toFixed(6)
    : '0';

  // Manejar dropdown positioning
  useEffect(() => {
    if (showInputDropdown && inputButtonRef.current) {
      const rect = inputButtonRef.current.getBoundingClientRect();
      setInputDropdownStyle({
        position: 'absolute',
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        zIndex: 200,
      });
    }
  }, [showInputDropdown]);

  useEffect(() => {
    if (showOutputDropdown && outputButtonRef.current) {
      const rect = outputButtonRef.current.getBoundingClientRect();
      setOutputDropdownStyle({
        position: 'absolute',
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        zIndex: 200,
      });
    }
  }, [showOutputDropdown]);

  // Estado y función para desenvolver WMATIC
  const [unwrapLoading, setUnwrapLoading] = useState(false);
  const handleUnwrapWMATIC = useCallback(
    async (amount) => {
      setUnwrapLoading(true);
      try {
        const provider = appState.provider;
        const signer = provider.getSigner();
        // Usa la address global si está en appState, si no, la hardcodeada
        const wmaticAddress = appState?.WMATIC_ADDRESS || '0xfB6204F05e8181DFDDF58A1A93CC608C850a58ba';
        const wmaticAbi = ['function withdraw(uint256 wad) public'];
        const wmaticContract = new ethers.Contract(wmaticAddress, wmaticAbi, signer);
        const amountWei = parseUnits(amount, 18);
        const tx = await wmaticContract.withdraw(amountWei);
        await tx.wait();
        setUnwrapLoading(false);
        appState.setSuccess(t('swap.unwrap_success', { hash: tx.hash }), tx.hash, `${appState.blockExplorer}/tx/${tx.hash}`);
        return tx.hash;
      } catch (err) {
        setUnwrapLoading(false);
        setError(t('swap.unwrap_error', { message: err.message }));
        return null;
      }
    },
    [appState, t]
  );

  return {
    showInputDropdown,
    setShowInputDropdown,
    showOutputDropdown,
    setShowOutputDropdown,
    inputDropdownRef,
    outputDropdownRef,
    inputButtonRef,
    outputButtonRef,
    inputDropdownStyle,
    outputDropdownStyle,
    inputToken,
    setInputToken,
    outputToken,
    setOutputToken,
    inputAmount,
    setInputAmount,
    outputAmount,
    setOutputAmount,
    liquidity,
    setLiquidity,
    percentOfPool,
    setPercentOfPool,
    warningHighPercent,
    setWarningHighPercent,
    loadingPrice,
    setLoadingPrice,
    loadingInfo,
    setLoadingInfo,
    error,
    setError,
    needsApproval,
    setNeedsApproval,
    isInputActive,
    setIsInputActive,
    approveLoading,
    approveError,
    swapLoading,
    swapError,
    allTokens,
    inputBalance,
    inputMetadata,
    outputMetadata,
    handleAmountChange,
    handleApprove,
    handleSwap,
    isValidInput,
    minReceived,
    t,
    getDirectPair,
    unwrapLoading,
    handleUnwrapWMATIC,
  };

}

export default useSwapData;