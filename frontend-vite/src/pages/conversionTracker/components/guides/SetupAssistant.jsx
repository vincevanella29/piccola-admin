import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import MetaPixelGuide from './MetaPixelGuide';
import GA4Guide from './GA4Guide';

const SetupAssistant = ({ form, handleCredChange, handleAnalyticsChange, rules, onSetupComplete, isEditing }) => {
  const { t } = useTranslation();
  // 0: Welcome, 1: Guide/Instructions, 2: Inputs, 3: Playground
  const [microStep, setMicroStep] = useState(isEditing ? 2 : 0);
  const [eventsFired, setEventsFired] = useState([]);

  const handleFireEvent = (event) => {
    setEventsFired((prev) => [...prev, event]);
  };

  const slideVariants = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 }
  };

  const handleNextMicroStep = () => {
    setMicroStep((prev) => prev + 1);
  };

  return (
    <div className="w-full max-w-2xl mx-auto min-h-[400px] flex flex-col justify-center relative bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 rounded-3xl p-6 lg:p-10 border border-light-border/40 dark:border-dark-border/40 shadow-2xl overflow-hidden">
      <AnimatePresence mode="wait">
        {form.service === 'meta' && (
          <motion.div
            key={`meta-${microStep}`}
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full"
          >
            <MetaPixelGuide 
              microStep={microStep} 
              form={form} 
              handleCredChange={handleCredChange} 
              onNext={handleNextMicroStep}
              onFinish={onSetupComplete}
              eventsFired={eventsFired}
              onFireEvent={handleFireEvent}
            />
          </motion.div>
        )}
        
        {form.service === 'analytics' && (
          <motion.div
            key={`ga4-${microStep}`}
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full"
          >
            <GA4Guide 
              microStep={microStep} 
              form={form} 
              handleAnalyticsChange={handleAnalyticsChange} 
              handleCredChange={handleCredChange}
              onNext={handleNextMicroStep}
              onFinish={onSetupComplete}
              eventsFired={eventsFired}
              onFireEvent={handleFireEvent}
            />
          </motion.div>
        )}

        {/* Fallback for other providers */}
        {form.service !== 'meta' && form.service !== 'analytics' && (
          <motion.div
            key="fallback"
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full text-center py-12"
          >
            <h3 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4">Configure {form.service}</h3>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-8">Enter the required credentials to connect this provider.</p>
            {rules && rules.required_keys && rules.required_keys.map((key) => (
              <div key={key} className="mb-4 text-left max-w-sm mx-auto">
                <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2 uppercase tracking-wider">
                  {rules?.labels?.[key] || rules?.field_labels?.[key] || key}
                </label>
                <input
                  name={`cred_${key}`}
                  value={form.credentials?.[key] || ''}
                  onChange={handleCredChange(key)}
                  className="w-full rounded-xl bg-light-surface/50 dark:bg-dark-surface/50 border border-light-border/40 dark:border-dark-border/40 px-4 py-3 text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-matrix-green transition-colors font-mono"
                />
              </div>
            ))}
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={onSetupComplete}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-matrix-green to-vanellix-cyan text-black font-bold flex items-center gap-2 shadow-neon transition-transform hover:scale-105"
              >
                {t('tracker_guides.assistant.finish', 'Looks Good! Continue')} <ChevronRight size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SetupAssistant;
