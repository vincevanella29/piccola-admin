// src/components/promotions/sections/rules/JobPositionRuleSection.jsx
import React, { useEffect, useState } from 'react';
import { BriefcaseIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import useEmpleadosCache from '../../../../../../hooks/useEmpleadosCache';

const JobPositionRuleSection = ({
    formData,
    setFormData,
    isLoading,
    appState,
}) => {
    const { t } = useTranslation();
    const { loadJobFilters, loading } = useEmpleadosCache(appState);
    const [availableSections, setAvailableSections] = useState([]);
    const [availablePositions, setAvailablePositions] = useState([]);

    const jobRule = formData.rules.find((r) => r.rule_type === 'require_job_position') || null;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await loadJobFilters();
                const sections = (response.secciones || []).filter(s => s && s !== 'all');
                const positions = (response.cargos || []).filter(c => c && c !== 'all');
                setAvailableSections(sections);
                setAvailablePositions(positions);
            } catch (err) {
                console.error('Error loading job filters:', err);
            }
        };
        fetchData();
    }, [loadJobFilters]);

    const handleSectionChange = (value) => {
        let newRules = formData.rules.filter((r) => r.rule_type !== 'require_job_position');

        if (value || jobRule?.job_position) {
            newRules.push({
                rule_type: 'require_job_position',
                job_section: value || null,
                job_position: jobRule?.job_position || null,
            });
        }

        setFormData((prev) => ({ ...prev, rules: newRules }));
    };

    const handlePositionChange = (value) => {
        let newRules = formData.rules.filter((r) => r.rule_type !== 'require_job_position');

        if (value || jobRule?.job_section) {
            newRules.push({
                rule_type: 'require_job_position',
                job_section: jobRule?.job_section || null,
                job_position: value || null,
            });
        }

        setFormData((prev) => ({ ...prev, rules: newRules }));
    };

    const handleRemove = () => {
        const newRules = formData.rules.filter((r) => r.rule_type !== 'require_job_position');
        setFormData((prev) => ({ ...prev, rules: newRules }));
    };

    if (loading) {
        return (
            <section className="max-w-4xl mx-auto">
                <h3 className="text-xl font-futurist text-neutral-900 dark:text-white mt-8 mb-4 px-1 flex items-center gap-2">
                    <BriefcaseIcon className="w-5 h-5 text-vanellix-cyan" />
                    {t('admin.promotions.rules.require_job_position')}
                </h3>
                <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6">
                    <p className="text-neutral-500 text-sm">{t('admin.loading')}</p>
                </div>
            </section>
        );
    }

    return (
        <section className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden p-6">
                <div className="space-y-4">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-vanellix-cyan/10 flex items-center justify-center text-vanellix-cyan">
                                <BriefcaseIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                                    {t('admin.promotions.rules.require_job_position')}
                                </h4>
                                <p className="text-xs text-neutral-500">
                                    {t('admin.promotions.rules.job_requirement_desc')}
                                </p>
                            </div>
                        </div>
                        {(jobRule?.job_section || jobRule?.job_position) && (
                            <button
                                onClick={handleRemove}
                                className="text-red-500 hover:text-red-600 p-1"
                                disabled={isLoading}
                            >
                                <XCircleIcon className="h-6 w-6" />
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                                {t('admin.promotions.rules.job_section')}
                                <span className="text-[10px] text-neutral-400">({t('admin.promotions.optional')})</span>
                            </label>
                            <select
                                value={jobRule?.job_section || ''}
                                onChange={(e) => handleSectionChange(e.target.value)}
                                className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan transition-all"
                                disabled={isLoading}
                            >
                                <option value="">{t('admin.promotions.rules.any_section')}</option>
                                {availableSections.map((section) => (
                                    <option key={section} value={section}>
                                        {section}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-neutral-500">
                                {t('admin.promotions.rules.job_section_tooltip')}
                            </p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                                {t('admin.promotions.rules.job_position')}
                                <span className="text-[10px] text-neutral-400">({t('admin.promotions.optional')})</span>
                            </label>
                            <select
                                value={jobRule?.job_position || ''}
                                onChange={(e) => handlePositionChange(e.target.value)}
                                className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan transition-all"
                                disabled={isLoading}
                            >
                                <option value="">{t('admin.promotions.rules.any_position')}</option>
                                {availablePositions.map((position) => (
                                    <option key={position} value={position}>
                                        {position}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-neutral-500">
                                {t('admin.promotions.rules.job_position_tooltip')}
                            </p>
                        </div>
                    </div>

                    {jobRule?.job_section && jobRule?.job_position && (
                        <div className="mt-4 p-3 bg-matrix-green/5 border border-matrix-green/20 rounded-lg">
                            <p className="text-xs text-neutral-700 dark:text-neutral-300">
                                ✓ {t('admin.promotions.rules.job_both_selected', {
                                    section: jobRule.job_section,
                                    position: jobRule.job_position
                                })}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default JobPositionRuleSection;
