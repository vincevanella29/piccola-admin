// src/components/promotions/sections/rules/TokenRuleSection.jsx
import React, { useState } from 'react';
import { BanknotesIcon, FireIcon, TrophyIcon } from '@heroicons/react/24/outline';
import TokenRuleBlock from './rules/components/TokenRuleBlock';

const TokenRuleSection = ({
  formData,
  handleSelectChange,
  isLoading,
  t,
  platformTokens,
  customSelectStyles,
  setFormData,
  meritSegments,
}) => {
  // Estado local para burn token (igual que en tu lógica original)
  const [selectedBurnToken, setSelectedBurnToken] = useState(
    formData.rules.find((rule) => rule.rule_type === 'burn_tokens')?.token_address || ''
  );

  // --- LOGIC: HOLD TOKENS ---
  const handleHoldTokensChange = (selected) => {
    const values = selected ? selected.map((item) => item.value) : [];
    const currentHoldTokens = formData.rules
      .filter((rule) => rule.rule_type === 'hold_tokens')
      .map((rule) => ({ token_address: rule.token_address, amount: rule.amount }));

    const updatedRules = [
      ...values.map((token_address) => {
        const existingRule = currentHoldTokens.find((rule) => rule.token_address === token_address);
        return {
          rule_type: 'hold_tokens',
          token_address,
          amount: existingRule ? existingRule.amount : 0,
        };
      }),
      // Mantenemos las reglas que no son hold_tokens
      ...formData.rules.filter((rule) => rule.rule_type === 'hold_tokens' ? false : true),
    ];

    // Para react-select visual (aunque el handleSelectChange maneja el form global)
    // Nota: Tu handleSelectChange parece esperar un evento de react-select, 
    // pero aquí estamos construyendo manually las reglas. 
    // Asumo que handleSelectChange actualiza formData.rules directamente con el 4to argumento.
    handleSelectChange(
      values.map((value) => ({
        value,
        label: platformTokens.find((token) => token.address === value)?.symbol || value,
      })),
      'rules',
      null,
      updatedRules
    );
  };

  const activeHoldRules = formData.rules
    .filter((rule) => rule.rule_type === 'hold_tokens')
    .map((rule) => {
      const tokenData = platformTokens.find((t) => t.address === rule.token_address);
      return {
        id: rule.token_address,
        symbol: tokenData?.symbol || rule.token_address,
        name: tokenData?.name,
        imagePath: tokenData?.imagePath,
        amount: rule.amount
      };
    });

  const holdSelectValue = activeHoldRules.map(r => ({
    value: r.id,
    label: `${r.symbol} (${r.name || ''})`
  }));

  // --- LOGIC: BURN TOKENS ---
  const handleBurnTokenChange = (selected) => {
    const value = selected ? selected.value : '';
    setSelectedBurnToken(value);

    const currentBurnRule = formData.rules.find((rule) => rule.rule_type === 'burn_tokens');
    
    // Filtramos todo menos burn tokens, luego añadimos el nuevo si existe
    const otherRules = formData.rules.filter((rule) => rule.rule_type !== 'burn_tokens');
    
    const updatedRules = [...otherRules];
    if (value) {
      updatedRules.push({
        rule_type: 'burn_tokens',
        token_address: value,
        amount: currentBurnRule ? currentBurnRule.amount : 0,
      });
    }

    handleSelectChange(
      value ? [{ value, label: platformTokens.find((token) => token.address === value)?.symbol || value }] : [],
      'rules',
      null,
      updatedRules
    );
  };

  const activeBurnRuleRaw = formData.rules.find((r) => r.rule_type === 'burn_tokens');
  const activeBurnItems = activeBurnRuleRaw ? [(() => {
    const tokenData = platformTokens.find((t) => t.address === activeBurnRuleRaw.token_address);
    return {
      id: activeBurnRuleRaw.token_address,
      symbol: tokenData?.symbol || activeBurnRuleRaw.token_address,
      name: tokenData?.name,
      imagePath: tokenData?.imagePath,
      amount: activeBurnRuleRaw.amount
    };
  })()] : [];

  const burnSelectValue = selectedBurnToken
    ? {
        value: selectedBurnToken,
        label: platformTokens.find((t) => t.address === selectedBurnToken)?.symbol || selectedBurnToken
      }
    : null;

  // --- LOGIC: MERIT WALLET ---
  // Mantenemos tu lógica inline de merit dentro del render original, pero adaptada para pasar props
  const meritRuleRaw = formData.rules.find((r) => r.rule_type === 'merit_min_wallet');
  
  const activeMeritItems = meritRuleRaw ? [(() => {
    const seg = (meritSegments || []).find((s) => s.token_id === meritRuleRaw.segment_token_id) || {};
    return {
      id: meritRuleRaw.segment_token_id,
      symbol: seg.symbol || `SEG${meritRuleRaw.segment_token_id}`,
      name: seg.name,
      amount: meritRuleRaw.amount
      // No imagePath typically for segments unless you have one
    };
  })()] : [];

  const meritSelectValue = meritRuleRaw ? (() => {
      const seg = (meritSegments || []).find((s) => s.token_id === meritRuleRaw.segment_token_id) || {};
      return {
        value: meritRuleRaw.segment_token_id,
        label: `${seg.symbol || `SEG${meritRuleRaw.segment_token_id}`} - ${seg.name || ''}`,
      };
  })() : null;

  const handleMeritChange = (selected) => {
    const tokenId = selected ? selected.value : null;
    setFormData((prev) => {
      const otherRules = prev.rules.filter((r) => r.rule_type !== 'merit_min_wallet');
      if (!tokenId) {
        return { ...prev, rules: otherRules };
      }
      const existing = prev.rules.find((r) => r.rule_type === 'merit_min_wallet') || {};
      return { 
        ...prev, 
        rules: [...otherRules, {
          rule_type: 'merit_min_wallet',
          segment_token_id: tokenId,
          amount: existing.amount || 0,
        }] 
      };
    });
  };

  // --- SHARED: AMOUNT BLUR ---
  const handleAmountBlur = (id, ruleType, value) => {
    const parsedValue = parseFloat(value);
    if (isNaN(parsedValue) || parsedValue <= 0) return;

    const updatedRules = [...formData.rules];
    
    // Buscar índice dependiendo del tipo de regla e ID
    const ruleIndex = updatedRules.findIndex((rule) => {
      if (rule.rule_type !== ruleType) return false;
      if (ruleType === 'merit_min_wallet') return rule.segment_token_id === id; // ID es int para merit
      return rule.token_address === id; // ID es string address para tokens
    });

    if (ruleIndex !== -1) {
      updatedRules[ruleIndex] = { ...updatedRules[ruleIndex], amount: parsedValue };
    } 
    // Nota: Si no existe el índice, tu lógica original lo creaba. 
    // Aquí asumimos que ya existe porque se renderiza desde activeItems.
    
    setFormData((prev) => ({ ...prev, rules: updatedRules }));
  };

  return (
    <section className="max-w-4xl mx-auto mt-6">
      <h3 className="text-xl font-futurist text-neutral-900 dark:text-white mb-4 px-1 flex items-center gap-2">
        {t('admin.promotions.token_rule')}
      </h3>

      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        
        {/* 1. HOLD TOKENS */}
        <TokenRuleBlock
          title={t('admin.promotions.rules.hold_tokens')}
          subtitle={t('admin.promotions.optional')}
          icon={BanknotesIcon}
          isMulti={true}
          options={platformTokens.map((token) => ({
            value: token.address,
            label: `${token.symbol} (${token.name})`,
          }))}
          value={holdSelectValue}
          onChange={handleHoldTokensChange}
          activeItems={activeHoldRules}
          onAmountBlur={(id, val) => handleAmountBlur(id, 'hold_tokens', val)}
          onRemove={(id) => handleHoldTokensChange(holdSelectValue.filter(v => v.value !== id))}
          isLoading={isLoading}
          customSelectStyles={customSelectStyles}
          t={t}
        />

        {/* 2. BURN TOKENS */}
        <TokenRuleBlock
          title={t('admin.promotions.rules.burn_tokens')}
          subtitle={t('admin.promotions.optional')}
          icon={FireIcon}
          isMulti={false}
          options={platformTokens.map((token) => ({
            value: token.address,
            label: `${token.symbol} (${token.name})`,
          }))}
          value={burnSelectValue}
          onChange={handleBurnTokenChange}
          activeItems={activeBurnItems}
          onAmountBlur={(id, val) => handleAmountBlur(id, 'burn_tokens', val)}
          onRemove={() => handleBurnTokenChange(null)}
          isLoading={isLoading}
          customSelectStyles={customSelectStyles}
          t={t}
        />

        {/* 3. MERIT MIN WALLET */}
        <TokenRuleBlock
          title={t('admin.promotions.rules.merit_min_wallet')}
          subtitle={t('admin.promotions.optional')}
          icon={TrophyIcon}
          isMulti={false}
          options={(meritSegments || []).map((seg) => ({
            value: seg.token_id,
            label: `${seg.symbol || `SEG${seg.token_id}`} - ${seg.name || ''}`,
          }))}
          value={meritSelectValue}
          onChange={handleMeritChange}
          activeItems={activeMeritItems}
          onAmountBlur={(id, val) => handleAmountBlur(id, 'merit_min_wallet', val)}
          onRemove={() => handleMeritChange(null)}
          isLoading={isLoading}
          customSelectStyles={customSelectStyles}
          t={t}
        />

      </div>
    </section>
  );
};

export default TokenRuleSection;