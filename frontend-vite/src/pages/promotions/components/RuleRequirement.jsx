import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useTokenMetadata } from '../../../hooks/useTokenMetadata';
import { useCommunityUser } from '../../../hooks/useCommunityUser';

const RuleRequirement = ({ rule, index, account, t, met, profile, appState, burnedBalance, meritSegments, meritBalances }) => {
  const navigate = useNavigate();
  const { updateProfileFieldData, setToggle } = useCommunityUser(appState);
  // Detect email from appState, just like NewsletterPrompt
  const detectedEmail =
    appState?.user?.google?.email ||
    appState?.user?.email?.address || '';
  const [inputValue, setInputValue] = useState(detectedEmail);
  const [error, setError] = useState(null);
  console.log(appState);

  const isHold = rule.rule_type === 'hold_tokens';
  const isBurn = rule.rule_type === 'burn_tokens';
  const isBirthday = rule.rule_type === 'birthday';
  const isCompleteProfile = rule.rule_type === 'require_complete_profile';
  const isPublicProfile = rule.rule_type === 'require_public_profile';
  const isSubscribeNews = rule.rule_type === 'require_subscribe_news';
  const isRequireBirthdate = rule.rule_type === 'require_birthdate';
  const isFavoriteLocation = rule.rule_type === 'require_favorite_location';
  const isMinLikedProducts = rule.rule_type === 'require_min_liked_products';
  const isMeritMinWallet = rule.rule_type === 'merit_min_wallet';
  const tokenAddress = rule.token_address;
  const required = Number(rule.amount);
  const minCount = Number(rule.min_count) || 0;

  // Only prefill the email input for subscribe_news if the input is empty and the user has an email in their profile (detectedEmail)
  React.useEffect(() => {
    if (isSubscribeNews && detectedEmail && inputValue === '') {
      setInputValue(detectedEmail);
    }
  }, [detectedEmail, isSubscribeNews]);

  const balance = isHold || isBurn ? appState?.tokenBalances?.[tokenAddress] || 0 : 0;
  const onchainMetadata = useTokenMetadata(rule.token_address);
  let decimals = 18;
  let onchainSymbol = 'Unknown';
  let symbol = 'Unknown';
  let imagePath;
  if (isHold || isBurn) {
    decimals = onchainMetadata.decimals || 18;
    onchainSymbol = onchainMetadata.symbol || 'Unknown';
    const metadata = rule.metadata || {};
    symbol = metadata.symbol || onchainSymbol;
    imagePath = metadata.imagePath;
  }

  const handleProfileUpdate = async (field, isToggle = false) => {
    // Si el usuario ya tiene email, solo activa el toggle
    if (field === 'subscribe_news') {
      if (profile?.email) {
        try {
          await setToggle('subscribe_news', true);
          setError(null);
        } catch (err) {
          setError(t('promotion-front.update_failed', { message: err.response?.data?.detail || err.message }));
        }
        return;
      } else {
        // Si no hay email, pide y actualiza el email antes de activar el toggle
        if (!inputValue.trim()) {
          setError(t('promotion-front.field_required', { field: t('promotion-front.email') }));
          return;
        }
        try {
          await updateProfileFieldData('email', inputValue.trim());
          await setToggle('subscribe_news', true);
          setError(null);
        } catch (err) {
          setError(t('promotion-front.update_failed', { message: err.response?.data?.detail || err.message }));
        }
        return;
      }
    }
    if (!inputValue.trim() && !isToggle) {
      setError(t('promotion-front.field_required', { field: t(`promotion-front.${field}`) }));
      return;
    }
    try {
      if (isToggle) {
        await setToggle(field, true);
      } else {
        await updateProfileFieldData(field, inputValue);
      }
      setError(null);
    } catch (err) {
      setError(t('promotion-front.update_failed', { message: err.response?.data?.detail || err.message }));
    }
  };

  const renderInputField = (field) => {
    if (field === 'subscribe_news' && !profile?.email) {
      return (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="email"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t('promotion-front.email')}
            className="flex-1 p-2 bg-transparent border border-matrix-green/50 rounded text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green transition-all"
          />
          <button
            onClick={() => handleProfileUpdate('subscribe_news')}
            className="px-2 py-1 border border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent rounded bg-transparent text-xs font-semibold hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-all focus:outline-none"
          >
            {t('promotion-front.subscribe_and_update')}
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 mt-2">
        <input
          type={field === 'birthdate' ? 'date' : field === 'email' ? 'email' : 'text'}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={t(`promotion-front.${field}`)}
          className="flex-1 p-2 bg-transparent border border-matrix-green/50 rounded text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green transition-all"
        />
        <button
          onClick={() => handleProfileUpdate(field)}
          className="px-2 py-1 border border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent rounded bg-transparent text-xs font-semibold hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-all focus:outline-none"
        >
          {t('promotion-front.update')}
        </button>
      </div>
    );
  };

  if (!account) {
    return (
      <li className="flex items-center gap-2 text-sm">
        <FaTimesCircle className="text-light-error dark:text-dark-error" />
        <span>{t('promotion-front.connect_wallet_to_check')}</span>
      </li>
    );
  }

  if (isMeritMinWallet) {
    const segmentsFromProfile = profile?.merit_profile?.segments || [];
    const segmentsFromAdmin = meritSegments || [];

    const segAdmin = segmentsFromAdmin.find((s) => s.token_id === rule.segment_token_id);
    const segProfile = segmentsFromProfile.find((s) => s.token_id === rule.segment_token_id);

    const name = (segAdmin && segAdmin.name)
      || (segProfile && segProfile.name)
      || t('promotion-front.merit_segment_default');

    const symbol = (segAdmin && segAdmin.symbol)
      || (segProfile && segProfile.symbol)
      || `SEG${rule.segment_token_id}`;

    const MERIT_DECIMALS = 18; // Méritos se manejan como enteros (sin 18 decimales)
    const toMeritHuman = (raw) => {
      if (raw === undefined || raw === null) return 0;
      const n = Number(raw);
      if (!Number.isFinite(n)) return 0;
      return n / 10 ** MERIT_DECIMALS;
    };

    const segmentId = rule.segment_token_id;
    const meritEntry = meritBalances?.[segmentId];

    // Preferimos lo que ya calculó el hook (on-chain) para que el texto coincida 100% con la lógica de met
    const balanceHuman =
      rule._meritBalanceHuman !== undefined
        ? Number(rule._meritBalanceHuman)
        : (meritEntry ? Number(meritEntry.human || 0) : toMeritHuman(segProfile?.balance || 0));

    const requiredBase = rule.amount || 0;
    const requiredMerit =
      rule._meritRequiredHuman !== undefined
        ? Number(rule._meritRequiredHuman)
        : toMeritHuman(requiredBase);

    const metFront = balanceHuman >= requiredMerit;
    const progress = requiredMerit > 0 ? Math.min((balanceHuman / requiredMerit) * 100, 100) : 0;

    return (
      <li className="flex flex-col gap-1 text-sm">
        <div className="flex items-center gap-2">
          {met ? (
            <FaCheckCircle className="text-matrix-green" />
          ) : (
            <FaTimesCircle className="text-light-error dark:text-dark-error" />
          )}
          <span>
            {t('promotion-front.merit_min_wallet', {
              symbol,
              name,
              required: requiredMerit,
              balance: balanceHuman,
            })}
          </span>
        </div>
        <div className="bg-light-surface-tertiary dark:bg-dark-surface-tertiary h-1 rounded overflow-hidden">
          <motion.div
            className="bg-matrix-green h-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </li>
    );
  }

  if (rule.rule_type === 'merit_rule_fulfilled') {
    // Nuevo modelo: solo 'current' o 'last', pero mantenemos compat con
    // valores antiguos mapeándolos a las mismas etiquetas.
    const rawPeriodKey = rule.ranking_period || 'current';
    let periodKey = rawPeriodKey;
    if (rawPeriodKey === 'current_month' || rawPeriodKey === 'current_year') periodKey = 'current';
    if (rawPeriodKey === 'last_month' || rawPeriodKey === 'last_year') periodKey = 'last';

    const periodLabelMap = {
      current: 'Periodo actual',
      last: 'Periodo anterior',
    };
    const periodLabel = periodLabelMap[periodKey] || periodKey;

    const meritProgress = rule.merit_progress || {};
    const progressEntry = Array.isArray(meritProgress.progress) && meritProgress.progress.length > 0
      ? meritProgress.progress[0]
      : null;

    const {
      position_type: positionType,
      ranking_position: rankingPosition,
      position_from: positionFrom,
      position_to: positionTo,
    } = meritProgress.params || {};

    let targetText = null;
    if (positionType === 'exact') {
      targetText = `Puesto ${rankingPosition}`;
    } else if (positionType === 'range') {
      targetText = `Puestos ${positionFrom}-${positionTo}`;
    } else if (positionType === 'top_n') {
      targetText = `Top ${rankingPosition}`;
    }

    const currentPosition = progressEntry?.current_position;
    const scope = progressEntry?.scope === 'local' ? `Local ${progressEntry?.local || ''}` : 'Empresa';

    return (
      <li className="flex flex-col gap-1 text-sm">
        <div className="flex items-center gap-2">
          {met ? (
            <FaCheckCircle className="text-matrix-green" />
          ) : (
            <FaTimesCircle className="text-light-error dark:text-dark-error" />
          )}
          <span>
            Regla de ranking: <strong>{rule.merit_rule_name}</strong> ({periodLabel})
          </span>
        </div>
        {progressEntry && currentPosition != null && targetText && (
          <div className="ml-6 text-xs text-light-text-secondary dark:text-dark-text-secondary">
            <span>
              Estado actual: {scope} · Puesto {currentPosition} &mdash; Objetivo: {targetText}
            </span>
          </div>
        )}
      </li>
    );
  }

  if (isBirthday || isRequireBirthdate) {
    return (
      <li className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2">
          {met ? (
            <FaCheckCircle className="text-matrix-green" />
          ) : (
            <FaTimesCircle className="text-light-error dark:text-dark-error" />
          )}
          <span>{t('promotion-front.birthday_required')}</span>
        </div>
        {!met && renderInputField('birthdate')}
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </li>
    );
  }

  if (isCompleteProfile) {
    return (
      <li className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2">
          {met ? (
            <FaCheckCircle className="text-matrix-green" />
          ) : (
            <FaTimesCircle className="text-light-error dark:text-dark-error" />
          )}
          <span>{t('promotion-front.require_complete_profile')}</span>
        </div>
        {!met && ['name', 'email', 'birthdate'].map((field) => (
          !profile?.[field] && (
            <div key={field}>
              {renderInputField(field)}
              {error && <p className="text-red-500 text-xs">{error}</p>}
            </div>
          )
        ))}
      </li>
    );
  }

  if (isPublicProfile) {
    return (
      <li className="flex items-center gap-2 text-sm">
        {met ? (
          <FaCheckCircle className="text-matrix-green" />
        ) : (
          <FaTimesCircle className="text-light-error dark:text-dark-error" />
        )}
        <span>{t('promotion-front.require_public_profile')}</span>
        {!met && (
          <button
            onClick={() => handleProfileUpdate('public_profile', true)}
            className="px-2 py-0.5 rounded bg-matrix-green text-white font-semibold text-xs hover:bg-matrix-green/90 transition-colors"
          >
            {t('promotion-front.update_profile')}
          </button>
        )}
      </li>
    );
  }

  if (isSubscribeNews) {
    return (
      <li className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2">
          {met ? (
            <FaCheckCircle className="text-matrix-green" />
          ) : (
            <FaTimesCircle className="text-light-error dark:text-dark-error" />
          )}
          <span>{t('promotion-front.require_subscribe_news')}</span>
        </div>
        {!met && renderInputField('subscribe_news')}
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </li>
    );
  }

  if (isFavoriteLocation) {
    return (
      <li className="flex items-center gap-2 text-sm">
        {met ? (
          <FaCheckCircle className="text-matrix-green" />
        ) : (
          <FaTimesCircle className="text-light-error dark:text-dark-error" />
        )}
        <span>{t('promotion-front.require_favorite_location')}</span>
        {!met && (
          <button
            onClick={() => navigate('/app/club/community')}
            className="px-2 py-0.5 rounded bg-matrix-green text-white font-semibold text-xs hover:bg-matrix-green/90 transition-colors"
          >
            {t('promotion-front.select_location')}
          </button>
        )}
      </li>
    );
  }

  if (isMinLikedProducts) {
    return (
      <li className="flex items-center gap-2 text-sm">
        {met ? (
          <FaCheckCircle className="text-matrix-green" />
        ) : (
          <FaTimesCircle className="text-light-error dark:text-dark-error" />
        )}
        <span>{t('promotion-front.require_min_liked_products', { count: minCount })}</span>
        {!met && (
          <button
            onClick={() => navigate('/app/club/community')}
            className="px-2 py-0.5 rounded bg-matrix-green text-white font-semibold text-xs hover:bg-matrix-green/90 transition-colors"
          >
            {t('promotion-front.like_products')}
          </button>
        )}
      </li>
    );
  }

  // Nueva regla: REQUIRE_JOB_POSITION
  if (rule.rule_type === 'require_job_position') {
    const jobSection = rule.job_section;
    const jobPosition = rule.job_position;

    let requirementText;
    if (jobSection && jobPosition) {
      requirementText = t('promotion-front.require_job_both', { section: jobSection, position: jobPosition });
    } else if (jobSection) {
      requirementText = t('promotion-front.require_job_section', { section: jobSection });
    } else if (jobPosition) {
      requirementText = t('promotion-front.require_job_position_detail', { position: jobPosition });
    } else {
      requirementText = t('promotion-front.require_job_position');
    }

    return (
      <li className="flex items-center gap-2 text-sm">
        {met ? (
          <FaCheckCircle className="text-matrix-green" />
        ) : (
          <FaTimesCircle className="text-light-error dark:text-dark-error" />
        )}
        <span>{requirementText}</span>
      </li>
    );
  }

  if (isHold) {
    return (
      <li className="flex items-center gap-2 text-sm">
        {imagePath && <img src={imagePath} alt={symbol} className="w-4 h-4 rounded-full" />}
        {met ? (
          <FaCheckCircle className="text-matrix-green" />
        ) : (
          <FaTimesCircle className="text-light-error dark:text-dark-error" />
        )}
        <span>
          {t('promotion-front.hold')} {required.toLocaleString()} {symbol} ({t('promotion-front.you_have')} {balance.toLocaleString()})
        </span>
      </li>
    );
  }

  if (isBurn) {
    const burned = burnedBalance && burnedBalance.saldo_human ? Number(burnedBalance.saldo_human) : 0;
    const progress = Math.min((burned / required) * 100, 100);
    return (
      <li className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm">
          {imagePath && <img src={imagePath} alt={symbol} className="w-4 h-4 rounded-full" />}
          {met ? (
            <FaCheckCircle className="text-matrix-green" />
          ) : (
            <FaTimesCircle className="text-light-error dark:text-dark-error" />
          )}
          <span>
            {t('promotion-front.burn')} {required.toLocaleString()} {symbol}
          </span>
        </div>
        <div className="bg-light-surface-tertiary dark:bg-dark-surface-tertiary h-1 rounded overflow-hidden">
          <motion.div
            className="bg-matrix-green h-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
          <span>
            {t('promotion-front.progress')}: {burned.toLocaleString()} / {required.toLocaleString()}
          </span>
          <span>
            {t('promotion-front.you_own')}: {balance.toLocaleString()} {symbol}
          </span>
        </div>
      </li>
    );
  }

  return null;
};

export default RuleRequirement;