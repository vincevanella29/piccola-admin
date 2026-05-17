import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Plus, ChevronRight, ChevronLeft, Save, CheckCircle2, BarChart3, Target, Flame, Megaphone, Zap, UploadCloud } from 'lucide-react';
import { useCTProvidersWizard } from '../../../hooks/conversionTracker/useCTProvidersWizard.jsx';
import SetupAssistant from './guides/SetupAssistant.jsx';

const getServiceIcon = (serviceKey) => {
  switch (serviceKey) {
    case 'analytics': return <BarChart3 className="text-blue-500" size={32} />;
    case 'meta': return <Target className="text-blue-600" size={32} />;
    case 'firebase': return <Flame className="text-orange-500" size={32} />;
    case 'google_ads': return <Megaphone className="text-green-500" size={32} />;
    case 'dittofeed': return <Zap className="text-yellow-500" size={32} />;
    default: return <BarChart3 className="text-gray-500" size={32} />;
  }
};

const CTProviders = ({
  loading, error,
  providers,
  onRefresh, onCreate, onUpdate,
  token, account,
  listServices: listServicesFn,
  getServiceRules: getServiceRulesFn,
  uploadCredentialsJson: uploadCredentialsJsonFn,
  ecosystemProviders = [],
  onTestProvider
}) => {
  const { t } = useTranslation();
  
  const {
    form, setForm,
    services, rules,
    serviceAccountFile, originalCreds,
    isWizardOpen, wizardStep,
    visibleRequiredKeys, editingId,
    handlers: {
      handleChange, handleAnalyticsChange, handleCredChange, handleFile,
      submit, startCreate, startEdit, closeWizard, handleNext, handleBack,
    }
  } = useCTProvidersWizard({
    providers, onRefresh, onCreate, onUpdate, token, account,
    listServicesFn, getServiceRulesFn, uploadCredentialsJsonFn
  });

  // --- RENDERS ---
  const renderWizardStep1 = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">{t('wizard.step1.title', 'Select Platform')}</h2>
        <p className="text-light-text-secondary dark:text-dark-text-secondary mt-2">{t('wizard.step1.subtitle', 'Choose the marketing service you want to connect.')}</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map(s => {
          const val = typeof s === 'string' ? s : (s?.service || s?.key || '');
          const isActive = form.service === val;
          const serviceTitle = t(`wizard.services.${val}.title`, typeof s === 'string' ? s : (s?.label || s?.service || val));
          const serviceDesc = t(`wizard.services.${val}.description`, '');
          
          return (
            <motion.div
              key={val}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setForm(prev => ({ ...prev, service: val, name: `${serviceTitle} Tracker` }))}
              className={`cursor-pointer rounded-2xl p-5 border-2 transition-all duration-300 ${
                isActive 
                  ? 'border-matrix-green bg-matrix-green/10 shadow-[0_0_15px_rgba(0,255,170,0.2)]' 
                  : 'border-light-border/40 dark:border-dark-border/40 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 hover:border-light-accent/50 dark:hover:border-dark-accent/50'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${isActive ? 'bg-matrix-green/20' : 'bg-light-surface/50 dark:bg-dark-surface/50'}`}>
                  {getServiceIcon(val)}
                </div>
                {isActive && <CheckCircle2 className="text-matrix-green" size={24} />}
              </div>
              <h3 className="font-bold text-lg text-light-text-primary dark:text-dark-text-primary mb-1">{serviceTitle}</h3>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary line-clamp-3">{serviceDesc}</p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );

  const handleTargetToggle = (slug) => {
    const currentTargets = Array.isArray(form.assigned_providers) 
      ? form.assigned_providers 
      : (form.assigned_providers ? form.assigned_providers.split(',').map(s => s.trim()) : []);
      
    if (currentTargets.includes(slug)) {
      handleChange({ target: { name: 'assigned_providers', value: currentTargets.filter(s => s !== slug).join(',') } });
    } else {
      handleChange({ target: { name: 'assigned_providers', value: [...currentTargets, slug].join(',') } });
    }
  };

  const currentTargetsArray = Array.isArray(form.assigned_providers) 
    ? form.assigned_providers 
    : (form.assigned_providers ? form.assigned_providers.split(',').map(s => s.trim()) : []);

  const renderWizardStep2 = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">Basic Configuration</h2>
        <p className="text-light-text-secondary dark:text-dark-text-secondary mt-2">Name your tracker and select where it should be injected.</p>
      </div>

      <div className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border border-light-border/30 dark:border-dark-border/30 rounded-3xl p-6 mb-6">
        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">{t('conversion_tracker.form.name.label', 'Name')}</label>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder={t('conversion_tracker.form.name.placeholder')}
          className="w-full rounded-xl bg-light-surface/50 dark:bg-dark-surface/50 border border-light-border/40 dark:border-dark-border/40 px-4 py-3 text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-matrix-green transition-colors"
        />
      </div>

      <div className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border border-light-border/30 dark:border-dark-border/30 rounded-3xl p-6 mb-6">
        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-4">Injection Targets (Ecosystem Providers)</label>
        {ecosystemProviders.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ecosystemProviders.map(ep => (
              <label key={ep._id || ep.id || ep.slug} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${currentTargetsArray.includes(ep.slug) ? 'bg-matrix-green/10 border-matrix-green text-matrix-green' : 'bg-light-surface/50 dark:bg-dark-surface/50 border-light-border/40 dark:border-dark-border/40 text-light-text-primary dark:text-dark-text-primary hover:border-light-border/80 dark:hover:border-dark-border/80'}`}>
                <input 
                  type="checkbox" 
                  className="w-5 h-5 accent-matrix-green cursor-pointer"
                  checked={currentTargetsArray.includes(ep.slug)}
                  onChange={() => handleTargetToggle(ep.slug)}
                />
                <div className="flex flex-col">
                  <span className="font-bold">{ep.name}</span>
                  <span className="text-xs opacity-80">{ep.domain || ep.slug}</span>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary italic">No ecosystem providers found. Tracker will be global.</p>
        )}
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-4">Leave all unchecked to apply this tracker globally across all domains.</p>
      </div>

      <div className="flex items-center gap-3 pt-4 px-2">
        <div className="relative flex items-center">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            checked={!!form.is_active}
            onChange={handleChange}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-matrix-green"></div>
        </div>
        <label htmlFor="is_active" className="text-sm font-medium cursor-pointer text-light-text-primary dark:text-dark-text-primary">Set as Active Tracker</label>
      </div>
    </motion.div>
  );

  const renderWizardStep3 = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">{t('conversionTracker.wizard.step2.title', 'Configure Credentials')}</h2>
        <p className="text-light-text-secondary dark:text-dark-text-secondary mt-2">{t('conversionTracker.wizard.step2.subtitle', 'Enter the credentials required for tracking.')}</p>
      </div>

      {/* Setup Assistant (Sequential Flow) */}
      <SetupAssistant 
        form={form} 
        handleCredChange={handleCredChange} 
        handleAnalyticsChange={handleAnalyticsChange}
        rules={rules}
        onSetupComplete={submit}
        isEditing={!!editingId}
      />

      {rules && (rules.file_keys || []).includes('service_account') && (
        <div className="pt-4 border-t border-light-border/20 dark:border-dark-border/20 mt-8">
          <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-3">{t('conversion_tracker.form.file.service_account.label')}</label>
          <div className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl border-light-border/40 dark:border-dark-border/40 hover:border-matrix-green/50 dark:hover:border-matrix-green/50 bg-light-surface/30 dark:bg-dark-surface/30 transition-all group overflow-hidden">
            <input type="file" accept="application/json" onChange={handleFile} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <UploadCloud size={32} className={`mb-2 ${serviceAccountFile ? 'text-matrix-green' : 'text-light-text-secondary dark:text-dark-text-secondary group-hover:text-matrix-green transition-colors'}`} />
            <p className="text-sm text-center text-light-text-secondary dark:text-dark-text-secondary px-4">
              {serviceAccountFile ? <span className="font-bold text-matrix-green">{serviceAccountFile.name}</span> : <span>Drag and drop your JSON here, or <span className="text-matrix-green font-semibold">browse</span></span>}
            </p>
          </div>
          {Boolean(form.credentials?.service_account_path || originalCreds?.service_account_path) && !serviceAccountFile && (
            <p className="text-xs text-matrix-green mt-2 flex items-center gap-1">
              <CheckCircle2 size={12} /> File already uploaded ({form.credentials?.service_account_path || originalCreds?.service_account_path})
            </p>
          )}
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {!!error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
            <AlertTriangle className="text-red-500" size={20} />
            <p className="text-red-500 text-sm">{String(error)}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!isWizardOpen ? (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-light-surface-secondary to-transparent dark:from-dark-surface-secondary dark:to-transparent p-6 rounded-2xl border border-light-border/30 dark:border-dark-border/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-matrix-green/10 rounded-bl-full -mr-10 -mt-10 pointer-events-none blur-2xl"></div>
              <div className="relative z-10">
                <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">Marketing Integrations</h3>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Manage your tracking pixels and analytics tools.</p>
              </div>
              <motion.button
                onClick={startCreate}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative z-10 flex items-center gap-2 px-5 py-2.5 bg-matrix-green text-black font-bold rounded-xl shadow-[0_0_15px_rgba(0,255,170,0.3)] hover:shadow-[0_0_20px_rgba(0,255,170,0.5)] transition-shadow"
              >
                <Plus size={18} />
                {t('conversion_tracker.actions.create', 'Create Tracker')}
              </motion.button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {(providers || []).map((p, idx) => (
                <motion.div 
                  key={p.id || idx}
                  className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-2xl border border-light-border/30 dark:border-dark-border/30 p-5 hover:border-light-accent/50 dark:hover:border-dark-accent/50 transition-colors group relative overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-light-surface/80 dark:bg-dark-surface/80 rounded-xl shadow-sm">
                        {getServiceIcon(p.service)}
                      </div>
                      <div>
                        <h4 className="font-bold text-light-text-primary dark:text-dark-text-primary truncate max-w-[150px]">{p.name || p.service}</h4>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${p.is_active ? 'bg-matrix-green/20 text-matrix-green' : 'bg-gray-500/20 text-gray-400 dark:text-gray-500'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-6 relative z-10">
                    <div className="flex justify-between text-xs">
                      <span className="text-light-text-secondary dark:text-dark-text-secondary">Service</span>
                      <span className="font-medium text-light-text-primary dark:text-dark-text-primary">{p.service}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-light-text-secondary dark:text-dark-text-secondary">Targets</span>
                      <span className="font-medium text-light-text-primary dark:text-dark-text-primary truncate max-w-[120px]">{(p.assigned_providers || []).join(', ') || 'Global'}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => startEdit(p)}
                      className={`relative z-10 py-2 rounded-lg bg-light-surface dark:bg-dark-surface text-sm font-semibold border border-light-border/40 dark:border-dark-border/40 hover:bg-matrix-green hover:text-black hover:border-matrix-green transition-colors text-light-text-primary dark:text-dark-text-primary ${p.service === 'analytics' || p.service === 'meta' ? 'w-1/2' : 'w-full'}`}
                    >
                      Edit Config
                    </button>
                    {(p.service === 'analytics' || p.service === 'meta') && (
                      <button 
                        onClick={() => onTestProvider && onTestProvider(p)}
                        className="relative z-10 w-1/2 py-2 rounded-lg bg-light-surface dark:bg-dark-surface text-sm font-semibold border border-light-border/40 dark:border-dark-border/40 hover:bg-vanellix-cyan hover:text-black hover:border-vanellix-cyan transition-colors text-light-text-primary dark:text-dark-text-primary"
                      >
                        Playground
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}

              {(!providers || providers.length === 0) && (
                <div className="col-span-full py-16 text-center border-2 border-dashed border-light-border/40 dark:border-dark-border/40 rounded-2xl flex flex-col items-center justify-center">
                  <div className="p-4 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-full mb-4">
                    <Target className="text-light-text-secondary dark:text-dark-text-secondary opacity-50" size={40} />
                  </div>
                  <h3 className="text-lg font-bold mb-1 text-light-text-primary dark:text-dark-text-primary">No Trackers Found</h3>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4 max-w-md">Connect your marketing tools to start analyzing your web traffic and conversions.</p>
                  <button onClick={startCreate} className="text-matrix-green font-semibold hover:underline">Connect your first provider</button>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="wizard" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center mb-8">
              {[1, 2, 3].map((step, idx) => (
                <React.Fragment key={step}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ${
                    wizardStep === step ? 'bg-matrix-green text-black shadow-[0_0_10px_rgba(0,255,170,0.5)]' :
                    wizardStep > step ? 'bg-matrix-green/30 text-matrix-green' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-gray-400'
                  }`}>
                    {wizardStep > step ? <CheckCircle2 size={16} /> : step}
                  </div>
                  {idx < 2 && (
                    <div className={`w-16 sm:w-24 h-1 mx-2 rounded-full transition-colors duration-300 ${wizardStep > step ? 'bg-matrix-green/50' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            <form onSubmit={submit} className="bg-light-surface/50 dark:bg-dark-surface/50 backdrop-blur-xl border border-light-border/20 dark:border-dark-border/20 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-matrix-green/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              
              <AnimatePresence mode="wait">
                {wizardStep === 1 && <motion.div key="step1">{renderWizardStep1()}</motion.div>}
                {wizardStep === 2 && <motion.div key="step2">{renderWizardStep2()}</motion.div>}
                {wizardStep === 3 && <motion.div key="step3">{renderWizardStep3()}</motion.div>}
              </AnimatePresence>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-10 pt-6 border-t border-light-border/20 dark:border-dark-border/20">
                <button type="button" onClick={closeWizard} className="px-5 py-2.5 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors">
                  {t('conversion_tracker.actions.cancel', 'Cancel')}
                </button>
                <div className="flex gap-3 w-full sm:w-auto justify-end">
                  {wizardStep > 1 && (
                    <button type="button" onClick={handleBack} className="px-5 py-2.5 rounded-xl border border-light-border/40 dark:border-dark-border/40 font-semibold hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary flex items-center gap-2 transition-colors text-light-text-primary dark:text-dark-text-primary">
                      <ChevronLeft size={18} /> {t('conversionTracker.wizard.buttons.back', 'Back')}
                    </button>
                  )}
                  {wizardStep < 3 && (
                    <button 
                      type="button" 
                      onClick={handleNext} 
                      disabled={(wizardStep === 1 && !form.service) || (wizardStep === 2 && !form.name)}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-matrix-green to-vanellix-cyan text-black font-bold flex items-center gap-2 shadow-neon disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {t('conversionTracker.wizard.buttons.next', 'Next Step')} <ChevronRight size={18} />
                    </button>
                  )}
                  {wizardStep === 3 && form.service !== 'meta' && form.service !== 'analytics' && (
                    <button type="submit" className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-matrix-green to-vanellix-cyan text-black font-bold flex items-center gap-2 shadow-neon hover:scale-105 transition-transform">
                      <Save size={18} /> {t('conversionTracker.wizard.buttons.finish', 'Save Tracker')}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CTProviders;
