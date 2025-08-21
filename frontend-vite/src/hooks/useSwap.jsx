import { useEffect, useState, useCallback } from 'react';
import { ethers, parseUnits, formatUnits } from 'ethers';
import { getContractInstance, getContractAbi } from '../context/contracts';
import { fetchSwap, fetchSwapTokenRoutes, fetchPairReserves } from '../utils/tokensData';

export function useSwap(appState) {
    const t = appState?.t;
    const [approveState, setApproveState] = useState({ loading: false, error: null });
    const [swapState, setSwapState] = useState({ loading: false, error: null, result: null });
    const [swapRoutes, setSwapRoutes] = useState({});
    const [routesLoading, setRoutesLoading] = useState(false);

    const normalizeRoutesKeysToLower = (routes) => {
        const result = {};
        Object.keys(routes).forEach((k) => {
            result[k.toLowerCase()] = routes[k].map(r => ({
                ...r,
                paymentToken: r.paymentToken.toLowerCase(), // opcional, pero ayuda para búsquedas
                pairAddress: r.pairAddress // no tocar addresses de contratos!
            }));
        });
        return result;
    };

    const refreshRoutes = useCallback(async () => {
        setRoutesLoading(true);
        try {
            const res = await fetchSwapTokenRoutes();
            const normalizedRoutes = normalizeRoutesKeysToLower(res.routes || {});
            setSwapRoutes(normalizedRoutes);
        } catch (err) {
            appState.setError(t('swap.error_fetching_routes'));
        } finally {
            setRoutesLoading(false);
        }
    }, [appState, t]);

    useEffect(() => {
        refreshRoutes();
    }, [refreshRoutes]);

    const NATIVE_TOKEN_ADDRESS = appState?.NATIVE_TOKEN_ADDRESS;
    const WMATIC_ADDRESS = appState?.WMATIC_ADDRESS;

    const getSwapRouterAddress = useCallback(async () => {
        try {
            const launchpad = getContractInstance('VanellixLaunchpad', appState?.provider);
            return await launchpad.getSwapRouter();
        } catch (err) {
            appState.setError(t('swap.error_fetching_router'));
            throw err;
        }
    }, [appState?.provider, t]);

    function toBackendAddress(tokenAddress) {
        if (!tokenAddress) return tokenAddress;
        if (tokenAddress.toLowerCase() === WMATIC_ADDRESS?.toLowerCase()) return NATIVE_TOKEN_ADDRESS;
        return tokenAddress;
    }

    function toERC20Address(tokenAddress) {
        if (!tokenAddress) return tokenAddress;
        if (tokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS?.toLowerCase()) return WMATIC_ADDRESS;
        return tokenAddress;
    }

    async function findBestSwapPathWithLiquidity(routes, from, to, provider, amountIn, inputDecimals, maxHops = 3) {
        if (!routes[from] || !routes[to]) {
            console.warn('[findBestSwapPathWithLiquidity] No routes found for from/to:', { from, to });
            return null;
        }

        const parsedAmountIn = amountIn;

        // Buscar par directo primero
        const directPair = routes[from].find(r => r.paymentToken.toLowerCase() === to.toLowerCase() && r.exists);
        if (directPair) {
            try {
                const reserves = await fetchPairReserves(directPair.pairAddress);
                const pairContract = new ethers.Contract(directPair.pairAddress, getContractAbi('UniswapV2Pair'), provider);
                const [token0, token1] = await Promise.all([pairContract.token0(), pairContract.token1()]);
                const isInputToken0 = from.toLowerCase() === token0.toLowerCase();
                const inputReserve = BigInt(isInputToken0 ? reserves.reserve0 : reserves.reserve1);
                const outputReserve = BigInt(isInputToken0 ? reserves.reserve1 : reserves.reserve0);

                const routerAddress = await getSwapRouterAddress();
                const routerContract = new ethers.Contract(routerAddress, getContractAbi('UniswapV2Router02'), provider);
                let outputAmount;
                try {
                    outputAmount = await routerContract.getAmountOut(parsedAmountIn, inputReserve, outputReserve);
                } catch (e) {
                    console.warn('[findBestSwapPathWithLiquidity] Error calculating output amount for direct pair:', e);
                    return null;
                }

                const outputDecimals = await (async () => {
                    try {
                        const erc20Abi = ["function decimals() view returns (uint8)"];
                        const tokenOutContract = new ethers.Contract(to, erc20Abi, provider);
                        return await tokenOutContract.decimals();
                    } catch (e) {
                        console.warn('[findBestSwapPathWithLiquidity] Error fetching output decimals:', e);
                        return inputDecimals;
                    }
                })();

                const liquidity = Number(formatUnits(outputReserve, outputDecimals));
                const outputAmountNum = Number(formatUnits(outputAmount, outputDecimals));
                const percentOfPool = ((outputAmountNum / (liquidity + outputAmountNum)) * 100).toFixed(2);
                const bottleneckLiquidity = outputReserve;

                return {
                    path: [from, to],
                    pairs: [directPair.pairAddress],
                    outputAmount: outputAmountNum,
                    percentOfPool,
                    bottleneckLiquidity,
                    liquidity,
                    warningHighPercent: Number(percentOfPool) > 10,
                };
            } catch (e) {
                console.warn('[findBestSwapPathWithLiquidity] Error with direct pair:', e);
            }
        }

        // Buscar multi-hop a través de tokens comunes
        const fromPairs = new Set(routes[from].filter(r => r.exists).map(r => r.paymentToken.toLowerCase()));
        const toPairs = new Set(routes[to].filter(r => r.exists).map(r => r.paymentToken.toLowerCase()));
        const commonTokens = [...fromPairs].filter(token => toPairs.has(token));

        if (commonTokens.length === 0) {
            console.warn('[findBestSwapPathWithLiquidity] No common tokens found for multi-hop:', { from, to });
            return null;
        }

        let bestResult = null;
        for (const commonToken of commonTokens) {
            const pair1 = routes[from].find(r => r.paymentToken.toLowerCase() === commonToken && r.exists);
            const pair2 = routes[to].find(r => r.paymentToken.toLowerCase() === commonToken && r.exists);

            if (pair1 && pair2) {
                try {
                    const reserves1 = await fetchPairReserves(pair1.pairAddress);
                    const reserves2 = await fetchPairReserves(pair2.pairAddress);
                    const pairContract1 = new ethers.Contract(pair1.pairAddress, getContractAbi('UniswapV2Pair'), provider);
                    const pairContract2 = new ethers.Contract(pair2.pairAddress, getContractAbi('UniswapV2Pair'), provider);
                    const [token01, token11] = await Promise.all([pairContract1.token0(), pairContract1.token1()]);
                    const [token02, token12] = await Promise.all([pairContract2.token0(), pairContract2.token1()]);

                    const isInputToken01 = from.toLowerCase() === token01.toLowerCase();
                    const inputReserve1 = BigInt(isInputToken01 ? reserves1.reserve0 : reserves1.reserve1);
                    const outputReserve1 = BigInt(isInputToken01 ? reserves1.reserve1 : reserves1.reserve0);

                    const isInputToken02 = commonToken.toLowerCase() === token02.toLowerCase();
                    const inputReserve2 = BigInt(isInputToken02 ? reserves2.reserve0 : reserves2.reserve1);
                    const outputReserve2 = BigInt(isInputToken02 ? reserves2.reserve1 : reserves2.reserve0);

                    const routerAddress = await getSwapRouterAddress();
                    const routerContract = new ethers.Contract(routerAddress, getContractAbi('UniswapV2Router02'), provider);

                    const decimals1 = await (async () => {
                        try {
                            const erc20Abi = ["function decimals() view returns (uint8)"];
                            const tokenContract = new ethers.Contract(commonToken, erc20Abi, provider);
                            return await tokenContract.decimals();
                        } catch (e) {
                            console.warn('[findBestSwapPathWithLiquidity] Error fetching decimals for commonToken:', e);
                            return inputDecimals;
                        }
                    })();
                    const decimals2 = await (async () => {
                        try {
                            const erc20Abi = ["function decimals() view returns (uint8)"];
                            const tokenOutContract = new ethers.Contract(to, erc20Abi, provider);
                            return await tokenOutContract.decimals();
                        } catch (e) {
                            console.warn('[findBestSwapPathWithLiquidity] Error fetching decimals for output token:', e);
                            return inputDecimals;
                        }
                    })();

                    let outputAmount1, outputAmount2;
                    try {
                        outputAmount1 = await routerContract.getAmountOut(parsedAmountIn, inputReserve1, outputReserve1);
                        const adjustedAmount1 = BigInt(outputAmount1.toString());
                        outputAmount2 = await routerContract.getAmountOut(adjustedAmount1, inputReserve2, outputReserve2);
                    } catch (e) {
                        console.warn('[findBestSwapPathWithLiquidity] Error calculating output amounts for multi-hop:', e);
                        continue;
                    }

                    const outputAmountNum = Number(formatUnits(outputAmount2, decimals2));
                    const liquidity = Number(formatUnits(outputReserve2, decimals2));
                    const percentOfPool = ((outputAmountNum / (liquidity + outputAmountNum)) * 100).toFixed(2);
                    const bottleneckLiquidity = outputReserve2 < outputReserve1 ? outputReserve2 : outputReserve1;

                    const currentResult = {
                        path: [from, commonToken, to],
                        pairs: [pair1.pairAddress, pair2.pairAddress],
                        outputAmount: outputAmountNum,
                        percentOfPool,
                        bottleneckLiquidity,
                        liquidity,
                        warningHighPercent: Number(percentOfPool) > 10,
                    };

                    if (!bestResult || currentResult.outputAmount > bestResult.outputAmount) {
                        bestResult = currentResult;
                    }
                } catch (e) {
                    console.warn('[findBestSwapPathWithLiquidity] Error with multi-hop pair:', e);
                }
            }
        }

        return bestResult;
    }

    const getBestSwapPath = useCallback(async (inputTokenAddress, outputTokenAddress, provider, amount, inputDecimals, directPair = null) => {
        if (!inputTokenAddress || !outputTokenAddress || !provider || !amount) return null;
        const inputBackendAddr = toBackendAddress(inputTokenAddress);
        const outputBackendAddr = toBackendAddress(outputTokenAddress);
        let amountIn;
        try {
            amountIn = parseUnits(amount, inputDecimals);
        } catch (e) {
            console.warn('[getBestSwapPath] Error parsing amount:', e);
            return null;
        }

        let result;
        if (directPair) {
            try {
                const reserves = await fetchPairReserves(directPair.pairAddress);
                const pairContract = new ethers.Contract(directPair.pairAddress, getContractAbi('UniswapV2Pair'), provider);
                const token0 = await pairContract.token0();
                const isInputToken0 = inputBackendAddr.toLowerCase() === token0.toLowerCase();
                const inputReserve = BigInt(reserves.reserve0);
                const outputReserve = BigInt(reserves.reserve1);
                const bottleneckLiquidity = outputReserve < inputReserve ? outputReserve : inputReserve;

                const routerAddress = await getSwapRouterAddress();
                const routerContract = new ethers.Contract(routerAddress, getContractAbi('UniswapV2Router02'), provider);
                const outputAmount = await routerContract.getAmountOut(amountIn, inputReserve, outputReserve);
                const outputDecimals = await (async () => {
                    try {
                        const erc20Abi = ["function decimals() view returns (uint8)"];
                        const tokenOutContract = new ethers.Contract(outputBackendAddr, erc20Abi, provider);
                        return await tokenOutContract.decimals();
                    } catch (e) {
                        return inputDecimals;
                    }
                })();
                const liquidity = Number(formatUnits(outputReserve.toString(), outputDecimals));
                const outputAmountNum = Number(formatUnits(outputAmount, outputDecimals));
                const percentOfPool = ((outputAmountNum / (liquidity + outputAmountNum)) * 100).toFixed(2);

                result = {
                    path: [inputBackendAddr, outputBackendAddr],
                    pairs: [directPair.pairAddress],
                    outputAmount: outputAmountNum,
                    percentOfPool,
                    bottleneckLiquidity,
                    liquidity,
                    warningHighPercent: Number(percentOfPool) > 10,
                };
            } catch (e) {
                console.warn('[getBestSwapPath] Error with direct pair:', e);
            }
        }

        if (!result) {
            result = await findBestSwapPathWithLiquidity(
                swapRoutes,
                inputBackendAddr,
                outputBackendAddr,
                provider,
                amountIn,
                inputDecimals,
                3
            );
        }

        if (!result) return null;
        return {
            path: result.path.map(toERC20Address),
            pairs: result.pairs,
            bottleneckLiquidity: result.bottleneckLiquidity,
            outputAmount: result.outputAmount,
            percentOfPool: result.percentOfPool,
            liquidity: result.liquidity,
            warningHighPercent: result.warningHighPercent,
        };
    }, [swapRoutes, toBackendAddress, toERC20Address, getSwapRouterAddress]);

    const checkAllowance = useCallback(
        async (token, amount, account) => {
            if (!appState?.provider || !account || !amount) return false;
            const address = toERC20Address(token?.address);
            if (address === WMATIC_ADDRESS) {
                console.warn('[useSwap] Skipping allowance check for native token (MATIC)', { token, amount, account, address });
                return true;
            }
            try {
                const erc20Abi = ["function allowance(address owner, address spender) view returns (uint256)"];
                const contract = new ethers.Contract(address, erc20Abi, appState.provider);
                const routerAddress = await getSwapRouterAddress();
                const allowance = await contract.allowance(account, routerAddress);
                const sufficient = BigInt(allowance) >= parseUnits(amount, token.decimals || 18);
                return sufficient;
            } catch (err) {
                appState.setError(t('swap.error_checking_allowance'));
                return false;
            }
        },
        [appState?.provider, getSwapRouterAddress]
    );

    const getPrice = useCallback(
        async (inputTokenAddress, outputTokenAddress, amount, inputDecimals, outputDecimals, directPair = null) => {
            if (!appState?.provider || !amount || !inputTokenAddress || !outputTokenAddress) return null;
            try {
                // Refrescar rutas si están vacías
                if (!swapRoutes[inputTokenAddress.toLowerCase()] || !swapRoutes[outputTokenAddress.toLowerCase()]) {
                    await refreshRoutes();
                }
                const result = await getBestSwapPath(
                    inputTokenAddress.toLowerCase(),
                    outputTokenAddress.toLowerCase(),
                    appState.provider,
                    amount,
                    inputDecimals,
                    directPair
                );
                if (!result || !result.path || !result.pairs) return null;
                function safeNum(val, fallback = 0) {
                    if (typeof val === 'string') val = Number(val);
                    return (val != null && isFinite(val) && !isNaN(val)) ? val : fallback;
                }
                function safeStr(val, fallback = '0') {
                    const n = safeNum(val);
                    return String(n);
                }
                const outputAmount = safeNum(result.outputAmount);
                const liquidity = safeNum(result.liquidity);
                const percentOfPool = safeNum(result.percentOfPool);
                return {
                    amount: safeStr(outputAmount),
                    liquidity: safeStr(liquidity),
                    percentOfPool: safeStr(percentOfPool),
                    warningHighPercent: !!result.warningHighPercent,
                };
            } catch (err) {
                appState.setError(t('swap.error_fetching_price'));
                throw err;
            }
        },
        [appState?.provider, getBestSwapPath, toBackendAddress, toERC20Address, swapRoutes, refreshRoutes]
    );

    const approve = {
        state: approveState,
        execute: useCallback(
            async (token, amount) => {
                setApproveState({ loading: true, error: null });
                try {
                    if (!appState?.account || !appState?.signTxData || !appState?.sendTx) {
                        appState.setError(t('wallet.connect_wallet'));
                        throw new Error('Wallet not connected');
                    }
                    const erc20Abi = ["function approve(address spender, uint256 amount) returns (bool)"];
                    const contract = new ethers.Contract(token.address, erc20Abi, appState.provider);
                    const routerAddress = await getSwapRouterAddress();
                    const encodedApproveData = contract.interface.encodeFunctionData('approve', [routerAddress, amount]);
                    const plainTextToSign = `Aprobación de ${token.symbol}\nToken: ${token.address}\nSpender: ${routerAddress}\nCantidad: ${formatUnits(amount, token.decimals || 18)}`;
                    const plainTextToDisplay = plainTextToSign.replace(/\n/g, ' ');
                    const signature = await appState.signTxData(plainTextToDisplay);
                    if (!signature) {
                        appState.setError(t('wallet.error_transfer'));
                        throw new Error('Signature failed');
                    }
                    const approveTx = { to: token.address, data: encodedApproveData, chainId: appState.chainId };
                    const approveHash = await appState.sendTx(approveTx, appState);
                    if (!approveHash) {
                        appState.setError(t('swap.error_approving_token', { symbol: token.symbol, message: '' }));
                        throw new Error('Approval transaction failed');
                    }
                    
                    if (!appState.isPrivyWalletActive){
                        // Esperar confirmación de la transacción de approve
                        await provider.waitForTransaction(approveHash);
                    }
                    setApproveState({ loading: false, error: null });
                    appState.setSuccess(t('swap.approve_token'));
                    return true;
                } catch (err) {
                    const message = t('swap.error_approving_token', { symbol: token.symbol, message: err.message });
                    setApproveState({ loading: false, error: message });
                    appState.setError(message);
                    return false;
                }
            },
            [appState, t, getSwapRouterAddress]
        ),
    };

    const swap = {
        state: swapState,
        execute: useCallback(
            async ({ inputToken, outputToken, inputAmount, outputAmount, inputDecimals, outputDecimals }) => {
                setSwapState({ loading: true, error: null, result: null });
                try {
                    if (!appState?.account || !appState?.signTxData || !appState?.sendTx) {
                        appState.setError(t('wallet.connect_wallet'));
                        throw new Error('Wallet not connected');
                    }
                    // Refrescar rutas antes del swap
                    if (!swapRoutes[inputToken.address.toLowerCase()] || !swapRoutes[outputToken.address.toLowerCase()]) {
                        await refreshRoutes();
                    }
                    const routerAddress = await getSwapRouterAddress();
                    const routerContract = new ethers.Contract(routerAddress, getContractAbi('UniswapV2Router02'), appState.provider);

                    // Obtener la ruta óptima desde getBestSwapPath
                    const swapPathResult = await getBestSwapPath(
                        inputToken.address.toLowerCase(),
                        outputToken.address.toLowerCase(),
                        appState.provider,
                        inputAmount,
                        inputDecimals
                    );
                    if (!swapPathResult || !swapPathResult.path || !swapPathResult.pairs) {
                        appState.setError(t('swap.error_no_liquidity'));
                        return null;
                    }

                    const amountIn = parseUnits(inputAmount, inputDecimals);
                    const amountOutMin = parseUnits((Number(outputAmount) * 0.99).toFixed(6), outputDecimals);
                    const path = swapPathResult.path; // Usar la ruta calculada (p. ej., [VFLX, USDC, PARE])
                    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

                    const encodedData = routerContract.interface.encodeFunctionData('swapExactTokensForTokens', [
                        amountIn,
                        amountOutMin,
                        path,
                        appState.account,
                        deadline,
                    ]);

                    const plainTextToSign = `Swap\nDe: ${inputAmount} ${inputToken.symbol}\nA: ${outputAmount} ${outputToken.symbol}\nMínimo recibido: ${formatUnits(amountOutMin, outputDecimals)} ${outputToken.symbol}\nRuta: ${path.join(' -> ')}`;
                    const plainData = plainTextToSign.replace(/\n/g, ' ');
                    const signature = await appState.signTxData(plainData);
                    if (!signature) {
                        appState.setError(t('wallet.error_transfer'));
                        throw new Error('Signature failed');
                    }

                    const swapData = {
                        encodedData,
                        signature,
                        plainData,
                        wallet: appState.account,
                        token: appState.token,
                        inputToken: inputToken.address,
                        outputToken: outputToken.address,
                    };

                    const { tx } = await fetchSwap(swapData, appState.account, appState.token);
                    const hash = await appState.sendTx(tx, appState);
                    if (!hash) {
                        appState.setError(t('swap.error_swapping'));
                        return null;
                    }
                    appState.setSuccess(t('swap.success_swap', { hash }), hash, `${appState.blockExplorer}/tx/${hash}`);
                    setSwapState({ loading: false, error: null, result: { hash } });
                    return hash;
                } catch (err) {
                    const message = t('swap.error_swapping', { message: err.message });
                    setSwapState({ loading: false, error: message, result: null });
                    appState.setError(message);
                    return null;
                }
            },
            [appState, t, getSwapRouterAddress, swapRoutes, refreshRoutes]
        ),
    };

    return { checkAllowance, approve, swap, getPrice, refreshRoutes };
}

export default useSwap;