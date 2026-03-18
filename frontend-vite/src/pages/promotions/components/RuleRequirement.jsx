import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useTokenMetadata } from '../../../hooks/useTokenMetadata';
import { useCommunityUser } from '../../../hooks/useCommunityUser';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrae el primer entry de progreso del campo `merit_progress.progress`.
 * El backend puede devolver progress como:
 *   - array de objetos → tomamos el [0]
 *   - un objeto directo → lo usamos tal cual
 *   - undefined / null  → null
 */
function extractProgressEntry(meritProgress) {
  if (!meritProgress) return null;
  const p = meritProgress.progress;
  if (!p) return null;
  if (Array.isArray(p)) return p.length > 0 ? p[0] : null;
  if (typeof p === 'object') return p;
  return null;
}

/**
 * Normaliza el ranking_period (compatibilidad con valores old + new)
 */
function normalizeRankingPeriod(raw) {
  if (!raw) return 'current';
  if (raw === 'current_month' || raw === 'current_year') return 'current';
  if (raw === 'last_month'    || raw === 'last_year')    return 'last';
  return raw;
}

// ─── RuleRequirement ──────────────────────────────────────────────────────────

const RuleRequirement = ({ rule, index, account, t, met, profile, appState, burnedBalance, meritSegments, meritBalances }) => {
  const navigate = useNavigate();
  const { updateProfileFieldData, setToggle } = useCommunityUser(appState);

  const detectedEmail =
    appState?.user?.google?.email ||
    appState?.user?.email?.address || '';
  const [inputValue, setInputValue] = useState(detectedEmail);
  const [error, setError]           = useState(null);

  const isHold              = rule.rule_type === 'hold_tokens';
  const isBurn              = rule.rule_type === 'burn_tokens';
  const isBirthday          = rule.rule_type === 'birthday';
  const isCompleteProfile   = rule.rule_type === 'require_complete_profile';
  const isPublicProfile     = rule.rule_type === 'require_public_profile';
  const isSubscribeNews     = rule.rule_type === 'require_subscribe_news';
  const isRequireBirthdate  = rule.rule_type === 'require_birthdate';
  const isFavoriteLocation  = rule.rule_type === 'require_favorite_location';
  const isMinLikedProducts  = rule.rule_type === 'require_min_liked_products';
  const isMeritMinWallet    = rule.rule_type === 'merit_min_wallet';

  const tokenAddress = rule.token_address;
  const required     = Number(rule.amount);
  const minCount     = Number(rule.min_count) || 0;

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
    decimals      = onchainMetadata.decimals || 18;
    onchainSymbol = onchainMetadata.symbol || 'Unknown';
    const metadata = rule.metadata || {};
    symbol    = metadata.symbol || onchainSymbol;
    imagePath = metadata.imagePath;
  }

  // ── Profile update helpers ─────────────────────────────────────────────────

  const handleProfileUpdate = async (field, isToggle = false) => {
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

  // ── No wallet connected ────────────────────────────────────────────────────

  if (!account) {
    return (
      <li className="flex items-center gap-2 text-sm">
        <FaTimesCircle className="text-light-error dark:text-dark-error" />
        <span>{t('promotion-front.connect_wallet_to_check')}</span>
      </li>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MERIT_MIN_WALLET — balance on-chain mínimo en segmento
  // ══════════════════════════════════════════════════════════════════════════
  if (isMeritMinWallet) {
    const segmentsFromProfile = profile?.merit_profile?.segments || [];
    const segmentsFromAdmin   = meritSegments || [];

    const segAdmin   = segmentsFromAdmin.find((s) => s.token_id === rule.segment_token_id);
    const segProfile = segmentsFromProfile.find((s) => s.token_id === rule.segment_token_id);

    const name   = (segAdmin?.name)   || (segProfile?.name)   || t('promotion-front.merit_segment_default');
    const symbol = (segAdmin?.symbol) || (segProfile?.symbol) || `SEG${rule.segment_token_id}`;

    const MERIT_DECIMALS = 18;
    const toMeritHuman   = (raw) => {
      if (raw === undefined || raw === null) return 0;
      const n = Number(raw);
      return Number.isFinite(n) ? n / 10 ** MERIT_DECIMALS : 0;
    };

    const segmentId   = rule.segment_token_id;
    const meritEntry  = meritBalances?.[segmentId];

    const balanceHuman =
      rule._meritBalanceHuman !== undefined
        ? Number(rule._meritBalanceHuman)
        : (meritEntry ? Number(meritEntry.human || 0) : toMeritHuman(segProfile?.balance || 0));

    const requiredBase  = rule.amount || 0;
    const requiredMerit =
      rule._meritRequiredHuman !== undefined
        ? Number(rule._meritRequiredHuman)
        : toMeritHuman(requiredBase);

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

  // ══════════════════════════════════════════════════════════════════════════
  // MERIT_RULE_FULFILLED — posición en ranking
  // Bugs solucionados:
  //   1. Texto hardcodeado → t()
  //   2. progress puede ser objeto o array → extractProgressEntry()
  //   3. currentPosition puede ser undefined si el backend no encontró al empleado
  //   4. scope/location manejados correctamente
  // ══════════════════════════════════════════════════════════════════════════
  if (rule.rule_type === 'merit_rule_fulfilled') {
    const rawPeriodKey = rule.merit_progress?.ranking_period || rule.ranking_period || 'current';
    const periodKey    = normalizeRankingPeriod(rawPeriodKey);


    const periodLabel = t(`promotion-front.ranking_period_${periodKey}`, {
      defaultValue: periodKey === 'current'
        ? t('promotion-front.ranking_period_current', 'Periodo actual')
        : t('promotion-front.ranking_period_last', 'Periodo anterior'),
    });

    const meritProgress = rule.merit_progress || {};

    // ── FIX: progress puede ser array u objeto ─────────────────────────────
    const progressEntry = extractProgressEntry(meritProgress);


    // ── Target: viene en progressEntry.target_position (del get_progress_data)
    //    Fallback a params.ranking_position (field del gamification rule)
    const targetPosition =
      progressEntry?.target_position ??
      meritProgress?.params?.ranking_position ??
      meritProgress?.params?.max_position ??
      null;

    // ── Construir targetText desde lo que tenemos ──────────────────────
    const targetText = targetPosition != null
      ? t('promotion-front.ranking_position_top', { n: targetPosition, defaultValue: `Top ${targetPosition}` })
      : null;

    // ── FIX: current_position puede estar en progressEntry o en la raíz ───
    const currentPosition =
      progressEntry?.current_position ??
      progressEntry?.position ??
      meritProgress?.current_position ??
      null;

    // ── Scope ────────────────────────────────────────────────────────
    const scopeRaw  = progressEntry?.scope || meritProgress?.params?.ranking_scope || 'empresa';
    const isLocal   = scopeRaw === 'local';
    const localName = progressEntry?.local_name || progressEntry?.location || progressEntry?.local || '';
    const scopeLabel = isLocal
      ? t('promotion-front.ranking_scope_local', { location: localName, defaultValue: `Local ${localName}` })
      : t('promotion-front.ranking_scope_company', { defaultValue: 'Empresa' });

    // ── Estado / datos visuales ──────────────────────────────────────────
    const hasPositionInfo = progressEntry !== null && currentPosition != null;
    const progressPct = hasPositionInfo && targetPosition != null
      ? Math.min(Math.round((targetPosition / currentPosition) * 100), 100)
      : 0;
    const topValue     = progressEntry?.top_value;
    const currentValue = progressEntry?.current_value;
    const metColorCls  = met ? 'text-matrix-green' : 'text-light-error dark:text-dark-error';


    return (
      <li className="flex flex-col gap-2 text-sm">
        {/* Header: icono + nombre + periodo + badge de posicion */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {met
              ? <FaCheckCircle className="text-matrix-green shrink-0 mt-0.5" />
              : <FaTimesCircle className="text-light-error dark:text-dark-error shrink-0 mt-0.5" />
            }
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-light-text-primary dark:text-dark-text-primary leading-tight truncate">
                {rule.merit_rule_name || t('promotion-front.ranking_rule_default', { defaultValue: 'Ranking de meritos' })}
              </span>
              <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                {scopeLabel} &middot; {periodLabel}
              </span>
            </div>
          </div>

          {/* Badge posicion actual */}
          {hasPositionInfo && (
            <div className={`shrink-0 flex flex-col items-center px-2.5 py-1 rounded-lg border ${
              met
                ? 'border-matrix-green/40 bg-matrix-green/10'
                : 'border-light-border dark:border-dark-border bg-light-surface-secondary dark:bg-dark-surface-secondary'
            }`}>
              <span className={`text-[9px] font-semibold uppercase tracking-wider ${metColorCls}`}>
                {t('promotion-front.ranking_your_pos', { defaultValue: 'Puesto' })}
              </span>
              <span className={`text-xl font-bold leading-none ${metColorCls}`}>
                #{currentPosition}
              </span>
              {targetPosition != null && (
                <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary">
                  meta: top {targetPosition}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Barra de progreso + ventas */}
        {hasPositionInfo && (
          <div className="ml-6 flex flex-col gap-1.5">
            {/* Barra */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-light-surface-tertiary dark:bg-dark-surface-tertiary h-1.5 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    met ? 'bg-matrix-green' : 'bg-light-accent dark:bg-dark-accent'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
              <span className={`text-xs font-semibold shrink-0 ${metColorCls}`}>
                {progressPct}%
              </span>
            </div>

            {/* Ventas actuales vs lider */}
            {(currentValue != null || topValue != null) && (
              <div className="flex items-center justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
                {currentValue != null && (
                  <span>
                    {t('promotion-front.ranking_your_sales', { defaultValue: 'Tus ventas' })}:
                    {' '}$<span className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                      {Number(currentValue).toLocaleString('es-CL')}
                    </span>
                  </span>
                )}
                {topValue != null && (
                  <span>
                    {t('promotion-front.ranking_top', { defaultValue: 'Lider' })}:
                    {' '}${Number(topValue).toLocaleString('es-CL')}
                  </span>
                )}
              </div>
            )}

            {/* Estado */}
            <div className="text-xs">
              {met ? (
                <span className="text-matrix-green font-semibold">
                  {t('promotion-front.ranking_met', { defaultValue: 'Vas primero! Cumples la meta' })}
                </span>
              ) : (
                <span className="text-light-text-secondary dark:text-dark-text-secondary">
                  {t('promotion-front.ranking_not_met', { defaultValue: 'Sigue compitiendo para llegar al top!' })}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Sin datos aun */}
        {!hasPositionInfo && (
          <div className="ml-6 text-xs text-light-text-secondary dark:text-dark-text-secondary italic">
            {meritProgress.status === 'evaluation_error'
              ? t('promotion-front.ranking_eval_error', { defaultValue: 'Error al evaluar tu posicion.' })
              : t('promotion-front.ranking_pending', { defaultValue: 'Evaluando tu posicion en el ranking...' })
            }
          </div>
        )}
      </li>
    );
  }


  // ══════════════════════════════════════════════════════════════════════════
  // Reglas de perfil / preferencias
  // ══════════════════════════════════════════════════════════════════════════

  if (isBirthday || isRequireBirthdate) {
    return (
      <li className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2">
          {met ? <FaCheckCircle className="text-matrix-green" /> : <FaTimesCircle className="text-light-error dark:text-dark-error" />}
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
          {met ? <FaCheckCircle className="text-matrix-green" /> : <FaTimesCircle className="text-light-error dark:text-dark-error" />}
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
        {met ? <FaCheckCircle className="text-matrix-green" /> : <FaTimesCircle className="text-light-error dark:text-dark-error" />}
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
          {met ? <FaCheckCircle className="text-matrix-green" /> : <FaTimesCircle className="text-light-error dark:text-dark-error" />}
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
        {met ? <FaCheckCircle className="text-matrix-green" /> : <FaTimesCircle className="text-light-error dark:text-dark-error" />}
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
        {met ? <FaCheckCircle className="text-matrix-green" /> : <FaTimesCircle className="text-light-error dark:text-dark-error" />}
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

  if (rule.rule_type === 'require_job_position') {
    const jobSection  = rule.job_section;
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
        {met ? <FaCheckCircle className="text-matrix-green" /> : <FaTimesCircle className="text-light-error dark:text-dark-error" />}
        <span>{requirementText}</span>
      </li>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TOKEN rules
  // ══════════════════════════════════════════════════════════════════════════

  if (isHold) {
    return (
      <li className="flex items-center gap-2 text-sm">
        {imagePath && <img src={imagePath} alt={symbol} className="w-4 h-4 rounded-full" />}
        {met ? <FaCheckCircle className="text-matrix-green" /> : <FaTimesCircle className="text-light-error dark:text-dark-error" />}
        <span>
          {t('promotion-front.hold')} {required.toLocaleString()} {symbol} ({t('promotion-front.you_have')} {balance.toLocaleString()})
        </span>
      </li>
    );
  }

  if (isBurn) {
    const burned   = burnedBalance?.saldo_human ? Number(burnedBalance.saldo_human) : 0;
    const progress = Math.min((burned / required) * 100, 100);
    return (
      <li className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm">
          {imagePath && <img src={imagePath} alt={symbol} className="w-4 h-4 rounded-full" />}
          {met ? <FaCheckCircle className="text-matrix-green" /> : <FaTimesCircle className="text-light-error dark:text-dark-error" />}
          <span>{t('promotion-front.burn')} {required.toLocaleString()} {symbol}</span>
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
          <span>{t('promotion-front.progress')}: {burned.toLocaleString()} / {required.toLocaleString()}</span>
          <span>{t('promotion-front.you_own')}: {balance.toLocaleString()} {symbol}</span>
        </div>
      </li>
    );
  }

  return null;
};

export default RuleRequirement;