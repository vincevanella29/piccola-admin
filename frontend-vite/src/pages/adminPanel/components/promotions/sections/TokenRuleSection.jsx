import React, { useState } from 'react';
import Select from 'react-select';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircleIcon } from '@heroicons/react/24/outline';

const TokenRuleSection = ({
  formData,
  handleChange,
  handleSelectChange,
  isLoading,
  t,
  platformTokens,
  tokenDecimals,
  customSelectStyles,
  setFormData,
}) => {
  const [selectedBurnToken, setSelectedBurnToken] = useState(
    formData.rules.find((rule) => rule.rule_type === 'burn_tokens')?.token_address || ''
  );

  // Handle HOLD_TOKENS selection
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
      ...formData.rules.filter((rule) => rule.rule_type === 'burn_tokens'),
    ];

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

  // Handle BURN_TOKENS selection
  const handleBurnTokenChange = (selected) => {
    const value = selected ? selected.value : '';
    setSelectedBurnToken(value);

    const currentBurnRule = formData.rules.find((rule) => rule.rule_type === 'burn_tokens');
    const updatedRules = [
      ...formData.rules.filter((rule) => rule.rule_type === 'hold_tokens'),
      ...(value
        ? [
            {
              rule_type: 'burn_tokens',
              token_address: value,
              amount: currentBurnRule ? currentBurnRule.amount : 0,
            },
          ]
        : []),
    ];

    handleSelectChange(
      value ? [{ value, label: platformTokens.find((token) => token.address === value)?.symbol || value }] : [],
      'rules',
      null,
      updatedRules
    );
  };

  // Handle amount change on blur
  const handleAmountBlur = (tokenAddress, ruleType, value) => {
    const parsedValue = parseFloat(value);
    if (isNaN(parsedValue) || parsedValue <= 0) return; // Ignore invalid or non-positive values

    const ruleIndex = formData.rules.findIndex(
      (rule) => rule.rule_type === ruleType && rule.token_address === tokenAddress
    );
    const updatedRules = [...formData.rules];
    if (ruleIndex !== -1) {
      updatedRules[ruleIndex] = { ...updatedRules[ruleIndex], amount: parsedValue };
    } else {
      updatedRules.push({
        rule_type: ruleType,
        token_address: tokenAddress,
        amount: parsedValue,
      });
    }

    setFormData((prev) => ({
      ...prev,
      rules: updatedRules,
    }));
  };

  // Get selected tokens for display
  const holdTokens = formData.rules
    .filter((rule) => rule.rule_type === 'hold_tokens')
    .map((rule) => ({
      value: rule.token_address,
      label: platformTokens.find((token) => token.address === rule.token_address)?.symbol || rule.token_address,
    }));

  const burnToken = selectedBurnToken
    ? [
        {
          value: selectedBurnToken,
          label: platformTokens.find((token) => token.address === selectedBurnToken)?.symbol || selectedBurnToken,
        },
      ]
    : [];

  return (
    <section className="p-6 bg-gradient-to-br from-light-surface/80 dark:from-dark-surface/80 to-light-surface/50 dark:to-dark-surface/50 rounded-2xl shadow-lg border border-light-border/20 dark:border-dark-border/20">
      <h3 className="text-2xl font-futurist text-light-text-primary dark:text-dark-text-primary mb-6 flex items-center gap-3">
        {t('admin.promotions.token_rule')}
      </h3>
      <div className="space-y-8">
        {/* HOLD_TOKENS Section */}
        <div className="border-b border-light-border/20 dark:border-dark-border/20 pb-6">
          <h4 className="text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary">
            {t('admin.promotions.rules.hold_tokens')}
            <span className="text-matrix-green text-xs"> ({t('admin.promotions.optional')})</span>
          </h4>
          <Select
            isMulti
            options={platformTokens.map((token) => ({
              value: token.address,
              label: `${token.symbol} (${token.name})`,
            }))}
            value={holdTokens}
            onChange={handleHoldTokensChange}
            styles={customSelectStyles}
            classNamePrefix="custom-select"
            isDisabled={isLoading}
            placeholder={t('admin.promotions.select_menu')}
          />
          <AnimatePresence>
            {holdTokens.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-wrap gap-2 mt-3"
              >
                {formData.rules
                  .filter((rule) => rule.rule_type === 'hold_tokens')
                  .map((rule) => (
                    <motion.div
                      key={rule.token_address}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-1 bg-gradient-to-r from-matrix-green/20 to-light-text-primary dark:from-matrix-green/10 dark:to-light-text-primary/10 text-light-text-primary dark:text-dark-text-primary px-3 py-1 rounded-full text-sm shadow-neon hover:shadow-lg transition-all"
                    >
                      {platformTokens.find((token) => token.address === rule.token_address)?.imagePath && (
                        <img
                          src={platformTokens.find((token) => token.address === rule.token_address).imagePath}
                          alt="Token"
                          className="w-4 h-4 rounded-full"
                        />
                      )}
                      {platformTokens.find((token) => token.address === rule.token_address)?.symbol ||
                        rule.token_address}
                      <input
                        type="number"
                        defaultValue={rule.amount || ''}
                        onBlur={(e) => handleAmountBlur(rule.token_address, 'hold_tokens', e.target.value)}
                        className="ml-2 w-24 p-1 bg-transparent border border-matrix-green/50 rounded text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green transition-all"
                        placeholder={t('admin.promotions.rules.amount')}
                        disabled={isLoading}
                        step="0.000000000000000001"
                        min="0"
                      />
                      <XCircleIcon
                        className="h-4 w-4 cursor-pointer text-vanellix-purple hover:text-vanellix-purple/80"
                        onClick={() =>
                          handleHoldTokensChange(
                            holdTokens.filter((token) => token.value !== rule.token_address)
                          )
                        }
                      />
                    </motion.div>
                  ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* BURN_TOKENS Section */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary">
            {t('admin.promotions.rules.burn_tokens')}
            <span className="text-matrix-green text-xs"> ({t('admin.promotions.optional')})</span>
          </h4>
          <Select
            options={platformTokens.map((token) => ({
              value: token.address,
              label: `${token.symbol} (${token.name})`,
            }))}
            value={burnToken}
            onChange={handleBurnTokenChange}
            styles={customSelectStyles}
            classNamePrefix="custom-select"
            isDisabled={isLoading}
            placeholder={t('admin.promotions.select_menu')}
            isClearable
          />
          <AnimatePresence>
            {burnToken.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-wrap gap-2 mt-3"
              >
                {formData.rules
                  .filter((rule) => rule.rule_type === 'burn_tokens')
                  .map((rule) => (
                    <motion.div
                      key={rule.token_address}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-1 bg-gradient-to-r from-matrix-green/20 to-light-text-primary dark:from-matrix-green/10 dark:to-light-text-primary/10 text-light-text-primary dark:text-dark-text-primary px-3 py-1 rounded-full text-sm shadow-neon hover:shadow-lg transition-all"
                    >
                      {platformTokens.find((token) => token.address === rule.token_address)?.imagePath && (
                        <img
                          src={platformTokens.find((token) => token.address === rule.token_address).imagePath}
                          alt="Token"
                          className="w-4 h-4 rounded-full"
                        />
                      )}
                      {platformTokens.find((token) => token.address === rule.token_address)?.symbol ||
                        rule.token_address}
                      <input
                        type="number"
                        defaultValue={rule.amount || ''}
                        onBlur={(e) => handleAmountBlur(rule.token_address, 'burn_tokens', e.target.value)}
                        className="ml-2 w-24 p-1 bg-transparent border border-matrix-green/50 rounded text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green transition-all"
                        placeholder={t('admin.promotions.rules.amount')}
                        disabled={isLoading}
                        step="0.000000000000000001"
                        min="0"
                      />
                      <XCircleIcon
                        className="h-4 w-4 cursor-pointer text-vanellix-purple hover:text-vanellix-purple/80"
                        onClick={() => handleBurnTokenChange(null)}
                      />
                    </motion.div>
                  ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default TokenRuleSection;