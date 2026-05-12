// src/hooks/useB2BPartner.jsx — State management for B2B partner portal
// Follows the same auth pattern as useMarketing.jsx
import { useState, useCallback, useRef } from 'react';
import * as api from '../utils/b2bData';

export default function useB2BPartner(appState) {
  const appRef = useRef(appState);
  appRef.current = appState;

  const getAuth = useCallback(() => ({
    token: appRef.current?.token,
    walletAddress: appRef.current?.account,
  }), []);

  // ── State ──
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ company_name: '', contact_email: '', contact_phone: '', description: '' });
  const [newCredentials, setNewCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  // ── Auth check ──
  const isAuthenticated = !!(appRef.current?.account || appRef.current?.isAuthenticated);

  // ── Fetch partner ──
  const fetchMyCompany = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.fetchMyCompany(getAuth());
      if (res.status !== 'not_registered') {
        setPartner(res);
      } else {
        setPartner(null);
      }
    } catch (e) {
      console.error('useB2BPartner.fetchMyCompany:', e);
    } finally {
      setLoading(false);
    }
  }, [getAuth]);

  // ── Register ──
  const handleRegister = useCallback(async (e) => {
    if (e?.preventDefault) e.preventDefault();
    try {
      setError('');
      await api.registerCompany({ ...getAuth(), data: formData });
      await fetchMyCompany();
    } catch (e) {
      setError(e.message || 'Error registering company');
    }
  }, [getAuth, formData, fetchMyCompany]);

  // ── Generate Dilithium Credentials ──
  const handleGenerateCredentials = useCallback(async () => {
    try {
      setError('');
      const res = await api.generateCredentials(getAuth());
      setNewCredentials(res);
      await fetchMyCompany();
    } catch (e) {
      setError(e.message || 'Error generating credentials');
    }
  }, [getAuth, fetchMyCompany]);

  // ── Recover Dilithium Credentials ──
  const handleRecoverCredentials = useCallback(async () => {
    try {
      setError('');
      if (!appRef.current?.provider) {
        throw new Error('Web3 Provider no encontrado. Conecta tu wallet.');
      }
      
      const signer = appRef.current.provider.getSigner();
      const message = "Autorizo revelar mi clave secreta B2B en Vanellix.";
      
      // Request signature from user's wallet
      const signature = await signer.signMessage(message);
      
      const res = await api.recoverCredentials({ 
        ...getAuth(), 
        message, 
        signature 
      });
      
      setNewCredentials(res); // Will show the decrypted mnemonic
    } catch (e) {
      if (e.code === 4001 || e.message?.includes('denied')) {
        setError('Firma cancelada por el usuario.');
      } else {
        setError(e.message || 'Error recuperando credenciales');
      }
    }
  }, [getAuth]);

  // ── Copy to clipboard ──
  const handleCopy = useCallback((text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return {
    // State
    partner, loading, error, formData, setFormData,
    newCredentials, copied, isAuthenticated,
    // Actions
    fetchMyCompany, handleRegister,
    handleGenerateCredentials, handleRecoverCredentials, handleCopy,
  };
}
