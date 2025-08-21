// src/components/promotions/AdminPromotionCreate.jsx
import React from 'react';
import PromotionForm from './PromotionForm';

const AdminPromotionCreate = ({ appState, onCreate, locations, menus, isLoading, setFormError, platformTokens, tokenDecimals, chileTime, mediaMap }) => {
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
      chileTime={chileTime}
      mediaMap={mediaMap}
    />
  );
};

export default AdminPromotionCreate;