// src/components/promotions/AdminPromotionCreate.jsx
import React from 'react';
import PromotionForm from './PromotionForm';

const AdminPromotionCreate = ({ appState, onCreate, locations, menus, isLoading, setFormError, platformTokens, tokenDecimals, meritSegments, meritRules, chileTime, mediaMap }) => {
  return (
    <PromotionForm
      appState={appState}
      onSubmit={onCreate}
      locations={locations}
      menus={menus}
      isLoading={isLoading}
      formError={null}
      setFormError={setFormError}
      isUpdate={false}
      platformTokens={platformTokens}
      tokenDecimals={tokenDecimals}
      meritSegments={meritSegments}
      meritRules={meritRules}
      chileTime={chileTime}
      mediaMap={mediaMap}
    />
  );
};

export default AdminPromotionCreate;