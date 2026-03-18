import React, { useEffect, useState } from 'react';
import { BriefcaseIcon, XCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import useEmpleadosCache from '../../../../../../hooks/useEmpleadosCache';

const selectClass =
  'w-full px-3 py-2.5 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 ' +
  'border border-light-border/60 dark:border-dark-border/60 rounded-xl text-sm ' +
  'text-light-text-primary dark:text-dark-text-primary ' +
  'focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/30 focus:border-vanellix-cyan/50 ' +
  'transition-all disabled:opacity-40';

const JobPositionRuleSection = ({ formData, setFormData, isLoading, appState }) => {
  const { t } = useTranslation();
  const { loadJobFilters, loading } = useEmpleadosCache(appState);
  const [availableSections, setAvailableSections] = useState([]);
  const [availablePositions, setAvailablePositions] = useState([]);

  const jobRule = formData.rules.find(r => r.rule_type === 'require_job_position') || null;

  useEffect(() => {
    loadJobFilters()
      .then(res => {
        setAvailableSections((res.secciones || []).filter(s => s && s !== 'all'));
        setAvailablePositions((res.cargos || []).filter(c => c && c !== 'all'));
      })
      .catch(err => console.error('Error loading job filters:', err));
  }, [loadJobFilters]);

  const handleSectionChange = value => {
    let newRules = formData.rules.filter(r => r.rule_type !== 'require_job_position');
    if (value || jobRule?.job_position) {
      newRules.push({ rule_type: 'require_job_position', job_section: value || null, job_position: jobRule?.job_position || null });
    }
    setFormData(prev => ({ ...prev, rules: newRules }));
  };

  const handlePositionChange = value => {
    let newRules = formData.rules.filter(r => r.rule_type !== 'require_job_position');
    if (value || jobRule?.job_section) {
      newRules.push({ rule_type: 'require_job_position', job_section: jobRule?.job_section || null, job_position: value || null });
    }
    setFormData(prev => ({ ...prev, rules: newRules }));
  };

  const handleRemove = () => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.filter(r => r.rule_type !== 'require_job_position'),
    }));
  };

  const hasRule = !!(jobRule?.job_section || jobRule?.job_position);

  return (
    <div className="rounded-2xl border border-light-border/50 dark:border-dark-border/50 bg-light-surface dark:bg-dark-surface overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-light-border/40 dark:border-dark-border/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-vanellix-cyan/10 flex items-center justify-center">
            <BriefcaseIcon className="h-4 w-4 text-vanellix-cyan" />
          </div>
          <div>
            <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary leading-none">
              {t('admin.promotions.rules.require_job_position')}
            </p>
            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
              {t('admin.promotions.rules.job_requirement_desc')}
            </p>
          </div>
        </div>
        {hasRule && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isLoading}
            className="text-light-text-secondary/40 hover:text-vanellix-purple transition-colors"
          >
            <XCircleIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {loading ? (
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary text-center py-4">{t('admin.loading')}</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Section */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                  {t('admin.promotions.rules.job_section')}
                  <span className="font-normal normal-case text-light-text-secondary/50 dark:text-dark-text-secondary/50">
                    ({t('admin.promotions.optional')})
                  </span>
                </label>
                <select
                  value={jobRule?.job_section || ''}
                  onChange={e => handleSectionChange(e.target.value)}
                  className={selectClass}
                  disabled={isLoading}
                >
                  <option value="">{t('admin.promotions.rules.any_section')}</option>
                  {availableSections.map(section => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
                <p className="text-[11px] text-light-text-secondary/60 dark:text-dark-text-secondary/60">
                  {t('admin.promotions.rules.job_section_tooltip')}
                </p>
              </div>

              {/* Position */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                  {t('admin.promotions.rules.job_position')}
                  <span className="font-normal normal-case text-light-text-secondary/50 dark:text-dark-text-secondary/50">
                    ({t('admin.promotions.optional')})
                  </span>
                </label>
                <select
                  value={jobRule?.job_position || ''}
                  onChange={e => handlePositionChange(e.target.value)}
                  className={selectClass}
                  disabled={isLoading}
                >
                  <option value="">{t('admin.promotions.rules.any_position')}</option>
                  {availablePositions.map(position => (
                    <option key={position} value={position}>{position}</option>
                  ))}
                </select>
                <p className="text-[11px] text-light-text-secondary/60 dark:text-dark-text-secondary/60">
                  {t('admin.promotions.rules.job_position_tooltip')}
                </p>
              </div>
            </div>

            {/* Active requirement chip */}
            {hasRule && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-matrix-green/5 border border-matrix-green/20">
                <CheckCircleIcon className="h-4 w-4 text-matrix-green shrink-0" />
                <p className="text-xs font-medium text-light-text-primary dark:text-dark-text-primary">
                  {t('admin.promotions.rules.job_both_selected', {
                    section: jobRule?.job_section || t('admin.promotions.rules.any_section'),
                    position: jobRule?.job_position || t('admin.promotions.rules.any_position'),
                  })}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobPositionRuleSection;
