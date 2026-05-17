import React, { useEffect } from 'react';
import useB2BPartner from '../../../hooks/useB2BPartner';

import WalletGate from './components/WalletGate';
import RegistrationForm from './components/RegistrationForm';
import PendingState from './components/PendingState';
import Dashboard from './components/Dashboard';

const PartnerPortal = ({ appState }) => {
  const {
    partner, loading, error, formData, setFormData,
    newCredentials, copied, isAuthenticated,
    fetchMyCompany, handleRegister,
    handleGenerateCredentials, handleRecoverCredentials, handleCopy,
  } = useB2BPartner(appState);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMyCompany();
    }
  }, [appState?.account, isAuthenticated, fetchMyCompany]);

  // ── Loading ──
  if (loading && isAuthenticated) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-matrix-green"></div>
      </div>
    );
  }

  // ── WALLET REQUIRED GATE — Security First ──
  if (!isAuthenticated) {
    return <WalletGate appState={appState} />;
  }

  // ── Not Registered Form ──
  if (!partner) {
    return (
      <RegistrationForm 
        error={error} 
        formData={formData} 
        setFormData={setFormData} 
        handleRegister={handleRegister} 
      />
    );
  }

  // ── Pending View ──
  if (partner.status === 'pending') {
    return <PendingState partner={partner} />;
  }

  // ── Approved Dashboard ──
  return (
    <Dashboard 
      partner={partner}
      error={error}
      newCredentials={newCredentials}
      copied={copied}
      loading={loading}
      handleCopy={handleCopy}
      handleGenerateCredentials={handleGenerateCredentials}
      handleRecoverCredentials={handleRecoverCredentials}
    />
  );
};

export default PartnerPortal;

export const pageMetadata = {
  path: '/app/b2b/partner',
  label: 'b2b.portal_label',
  category: 'marketing.category',
  minRoleLevel: -1,
  order: 99,
  locations: ['sidebar'],
  description: 'b2b.portal_desc',
  icon: 'FiBriefcase',
  isSearchable: true,
};
