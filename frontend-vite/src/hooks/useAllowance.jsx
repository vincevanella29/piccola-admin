import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

/**
 * useAllowance - React hook para consultar allowance de cualquier ERC20/token
 * @param {string} tokenAddress - Dirección del token ERC20
 * @param {string} owner - Dirección del owner (wallet)
 * @param {string} spender - Dirección del contrato que gastará los tokens
 * @param {object} provider - Instancia de ethers.js provider
 * @param {Array} abi - (Opcional) ABI del token, por defecto usa el estándar ERC20
 * @returns {BigInt|null} allowance, isLoading, error, refetch
 */
const erc20Abi = [
  'function allowance(address owner, address spender) view returns (uint256)'
];

/**
 * useAllowance - Consulta y gestiona allowance de cualquier ERC20/token.
 * Incluye approve automático con patrón Privy/wagmi (signTxData + sendTransaction).
 * @param {string} tokenAddress - Dirección del token ERC20
 * @param {string} owner - Dirección del owner (wallet)
 * @param {string} spender - Dirección del contrato que gastará los tokens
 * @param {object} provider - Instancia de ethers.js provider
 * @param {object} wallet - Objeto de wallet con funciones signTxData y sendTransaction (Privy/wagmi)
 * @param {string|number|BigInt} amount - (Opcional) Monto requerido para approve (si se usa approveAllowance)
 * @param {Array} abi - (Opcional) ABI del token, por defecto usa el estándar ERC20
 * @returns {Object} { allowance, isLoading, error, refetch, approveAllowance, approving, approveError }
 *
 * Ejemplo de uso:
 *   const { allowance, isLoading, approveAllowance, approving } = useAllowance({
 *     tokenAddress, owner, spender, provider, wallet, amount
 *   });
 *   // Llama approveAllowance() si allowance < amount
 */
export default function useAllowance({ tokenAddress, owner, spender, provider, wallet, amount, abi = erc20Abi }) {
  const [allowance, setAllowance] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState(null);

  const fetchAllowance = useCallback(async () => {
    if (!tokenAddress || !owner || !spender || !provider) return;
    setIsLoading(true);
    setError(null);
    try {
      const contract = new ethers.Contract(tokenAddress, abi, provider);
      const value = await contract.allowance(owner, spender);
      setAllowance(value);
    } catch (e) {
      setError(e);
      setAllowance(null);
    } finally {
      setIsLoading(false);
    }
  }, [tokenAddress, owner, spender, provider, abi]);

  useEffect(() => {
    fetchAllowance();
  }, [fetchAllowance]);

  // --- Approve completo estilo Privy/wagmi ---
  const approveAllowance = useCallback(async ({ customAmount, customSpender, customTokenAddress, customWallet, customProvider, customAbi } = {}) => {
    setApproveError(null);
    setApproving(true);
    try {
      const _spender = customSpender || spender;
      const _tokenAddress = customTokenAddress || tokenAddress;
      const _amount = customAmount || amount;
      const _wallet = customWallet || wallet;
      const _provider = customProvider || provider;
      const _abi = customAbi || abi;
      if (!_tokenAddress || !_spender || !_amount || !_wallet || !_wallet.signTxData || !_wallet.sendTransaction || !_provider) {
        throw new Error('No wallet or token data');
      }
      const contract = new ethers.Contract(_tokenAddress, _abi, _provider);
      const encodedApproveData = contract.interface.encodeFunctionData('approve', [_spender, _amount]);
      const plainTextToSign = `Aprobación de Tokens (Allowance)\nToken: ${_tokenAddress}\nSpender: ${_spender}\nCantidad: ${ethers.formatEther(_amount)}`;
      const plainTextToDisplay = plainTextToSign.replace(/\n/g, ' ');
      await _wallet.signTxData(plainTextToDisplay);
      const approveTx = {
        to: _tokenAddress,
        data: encodedApproveData,
        chainId: _provider._network?.chainId || _provider.chainId,
      };
      const approveHash = await _wallet.sendTransaction(approveTx, _wallet);
      if (!_wallet.isPrivyWalletActive) {
        await _provider.waitForTransaction(approveHash);
      }
      // Verificar allowance actualizado
      const updatedAllowance = await contract.allowance(_wallet?.account, _spender);
      if (BigInt(updatedAllowance) < BigInt(_amount)) {
        setApproveError('El allowance sigue siendo insuficiente');
        setApproving(false);
        return;
      }
      setApproving(false);
      fetchAllowance();
      return true;
    } catch (err) {
      setApproveError(err.message || err);
      setApproving(false);
      if (_wallet?.setError) _wallet.setError(err.message || err);
      return false;
    }
  }, [spender, tokenAddress, amount, wallet, provider, abi, fetchAllowance]);

  return { allowance, isLoading, error, refetch: fetchAllowance, approveAllowance, approving, approveError };
}
