import React from 'react';
import { motion } from 'framer-motion';

const steps = ["General", "Lógica", "Destinatarios"];

const CompletionTracker = ({ currentStep, setCurrentStep }) => {
  const completionPercentage = ((currentStep - 1) / (steps.length -1)) * 100;

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        {steps.map((step, index) => {
            const stepIndex = index + 1;
            const isCompleted = currentStep > stepIndex;
            const isActive = currentStep === stepIndex;
          return (
            <div
              key={step}
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setCurrentStep(stepIndex)}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isCompleted ? 'bg-matrix-green text-white' : isActive ? 'bg-matrix-green/20 text-matrix-green border-2 border-matrix-green' : 'bg-light-surface-secondary dark:bg-dark-surface text-light-text-secondary dark:text-dark-text-secondary'
                }`}
              >
                {stepIndex}
              </div>
              <span className={`font-semibold transition-colors ${isActive ? 'text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{step}</span>
            </div>
          );
        })}
      </div>
      <div className="w-full bg-light-surface-secondary dark:bg-dark-surface h-1.5 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-matrix-green"
          initial={{ width: 0 }}
          animate={{ width: `${completionPercentage}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
};

export default CompletionTracker;