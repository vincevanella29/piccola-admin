import { useState } from 'react';
import appData from '../utils/appData.jsx';
import { getContractInstance } from '../context/contracts';
import { useCallback } from 'react';

/**
 * usePlatformSettings
 * Maneja la lógica para setear y consultar el fee token y fee percentage de la plataforma.
 * Devuelve helpers, loading states, errores y los últimos resultados de la API.
 */

export default function usePlatformSettings({appState, t }) {
  const [feeTokenResult, setFeeTokenResult] = useState(null);
  const [feeTokenLoading, setFeeTokenLoading] = useState(false);
  const [feeTokenError, setFeeTokenError] = useState(null);

  const [feePercentageResult, setFeePercentageResult] = useState(null);
  const [feePercentageLoading, setFeePercentageLoading] = useState(false);
  const [feePercentageError, setFeePercentageError] = useState(null);

  // Setear token de fee
  const setPlatformFeeToken = async ({ fee_token_address }) => {
    setFeeTokenLoading(true);
    setFeeTokenError(null);
    try {
        if (!appState.signTxData || !appState.sendTx || !appState.accessToken) {
            appState.setError(t('wallet.transfer_error'));
            return;
        }
        const contract = getContractInstance('VanellixLaunchpad'); // o el contrato correcto
        const encodedData = contract.interface.encodeFunctionData('setFeeToken', [fee_token_address]);
        const plainText = `Setear Token de Fee\nToken: ${fee_token_address}`;

        const signature = await appState.signTxData(plainText, appState);

        const res = await appData.setPlatformFeeToken({
            token: appState.accessToken,
            wallet: appState.account,
            fee_token_address,
            encodedData,
            signature,
            plainData: plainText,
      });
      const tx = res.tx;
      const hash = await appState.sendTx(tx, appState);
      await appState.provider.waitForTransaction(hash);
      setFeeTokenResult(res?.data);
      return res?.data;
    } catch (err) {
      appState.setError(t(err.message));
      throw err;
    } finally {
      setFeeTokenLoading(false);
    }
  };

  // Setear porcentaje de fee
  const setPlatformFeePercentage = async ({ fee_percentage }) => {
    setFeePercentageLoading(true);
    setFeePercentageError(null);
    try {
        if (!appState.signTxData || !appState.sendTx || !appState.accessToken) {
            appState.setError(t('wallet.transfer_error'));
            return;
        }
        const contract = getContractInstance('VanellixLaunchpad'); // o el contrato correcto
        const encodedData = contract.interface.encodeFunctionData('setFeePercentage', [fee_percentage]);
        const plainText = `Setear Porcentaje de Fee\nPorcentaje: ${fee_percentage}`;

        const signature = await appState.signTxData(plainText, appState);

        const res = await appData.setPlatformFeePercentage({
            token: appState.accessToken,
            wallet: appState.account,
            fee_percentage,
            encodedData,
            signature,
            plainData: plainText,
      });
      const tx = res?.tx;
      const hash = await appState.sendTx(tx, appState);
      appState.setSuccess(t('wallet.success'));
      await appState.provider.waitForTransaction(hash);
      setFeePercentageResult(res?.data);
      return res?.data;
    } catch (err) {
      appState.setError(t(err.message));
      throw err;
    } finally {
      setFeePercentageLoading(false);
    }
  };

  // Obtener el fee token actual
  const [currentFeeToken, setCurrentFeeToken] = useState(null);
  const [currentFeeTokenLoading, setCurrentFeeTokenLoading] = useState(false);
  const [currentFeeTokenError, setCurrentFeeTokenError] = useState(null);

  // Obtener el fee percentage actual
  const [currentFeePercentage, setCurrentFeePercentage] = useState(null);
  const [currentFeePercentageLoading, setCurrentFeePercentageLoading] = useState(false);
  const [currentFeePercentageError, setCurrentFeePercentageError] = useState(null);

  // Función para leer el fee token desde el contrato
  const getFeeToken = useCallback(async () => {
    setCurrentFeeTokenLoading(true);
    setCurrentFeeTokenError(null);
    try {
      // --- Provider seguro para ethers v6 ---
      let provider = appState.provider;
      if (!provider && typeof window !== 'undefined' && window.ethereum) {
        try {
          const { BrowserProvider } = await import('ethers');
          provider = new BrowserProvider(window.ethereum);
        } catch (e) {
          setCurrentFeeTokenError('No se pudo inicializar el provider de ethers.');
          setCurrentFeeToken(null);
          setCurrentFeeTokenLoading(false);
          return null;
        }
      }
      if (!provider) {
        setCurrentFeeTokenError('Provider de Ethereum no disponible.');
        setCurrentFeeToken(null);
        setCurrentFeeTokenLoading(false);
        return null;
      }
      const contract = getContractInstance('VanellixLaunchpad', provider);
      const res = await contract.getFeeToken();
      setCurrentFeeToken(res);
      return res;
    } catch (err) {
      setCurrentFeeTokenError(err.message);
      setCurrentFeeToken(null);
      return null;
    } finally {
      setCurrentFeeTokenLoading(false);
    }
  }, [appState]);

  // Función para leer el fee percentage desde el contrato
  const getFeePercentage = useCallback(async () => {
    setCurrentFeePercentageLoading(true);
    setCurrentFeePercentageError(null);
    try {
      // --- Provider seguro para ethers v6 ---
      let provider = appState.provider;
      if (!provider && typeof window !== 'undefined' && window.ethereum) {
        try {
          const { BrowserProvider } = await import('ethers');
          provider = new BrowserProvider(window.ethereum);
        } catch (e) {
          setCurrentFeePercentageError('No se pudo inicializar el provider de ethers.');
          setCurrentFeePercentage(null);
          setCurrentFeePercentageLoading(false);
          return null;
        }
      }
      if (!provider) {
        setCurrentFeePercentageError('Provider de Ethereum no disponible.');
        setCurrentFeePercentage(null);
        setCurrentFeePercentageLoading(false);
        return null;
      }
      const contract = getContractInstance('VanellixLaunchpad', provider);
      const res = await contract.getFeePercentage();
      setCurrentFeePercentage(Number(res));
      return Number(res);
    } catch (err) {
      setCurrentFeePercentageError(err.message);
      setCurrentFeePercentage(null);
      return null;
    } finally {
      setCurrentFeePercentageLoading(false);
    }
  }, [appState]);

  return {
    // Setters
    setPlatformFeeToken,
    setPlatformFeePercentage,
    // Results y loaders
    feeTokenResult,
    feeTokenLoading,
    feeTokenError,
    feePercentageResult,
    feePercentageLoading,
    feePercentageError,
    // Getters actuales
    getFeeToken,
    getFeePercentage,
    currentFeeToken,
    currentFeeTokenLoading,
    currentFeeTokenError,
    currentFeePercentage,
    currentFeePercentageLoading,
    currentFeePercentageError,
  };
}
