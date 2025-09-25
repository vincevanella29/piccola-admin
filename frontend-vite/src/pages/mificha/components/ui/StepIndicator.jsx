import React from 'react';
import { FaFingerprint, FaIdCard, FaCheckCircle } from 'react-icons/fa';

const Step = ({ icon, label, stepNumber, currentStep }) => {
  const isActive = stepNumber === currentStep;
  const isCompleted = stepNumber < currentStep;

  const getStatusClasses = () => {
    if (isActive) return 'border-matrix-green text-matrix-green bg-matrix-green/10';
    if (isCompleted) return 'border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent bg-light-accent/10';
    return 'border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary';
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${getStatusClasses()}`}>
        {React.createElement(icon, { className: 'w-6 h-6' })}
      </div>
      <span className={`text-sm font-medium transition-colors ${isActive || isCompleted ? 'text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
        {label}
      </span>
    </div>
  );
};

const StepIndicator = ({ currentStep }) => (
  <div className="w-full max-w-md flex justify-center items-start gap-4">
    <Step icon={FaIdCard} label="Identidad" stepNumber={1} currentStep={currentStep} />
    <div className={`flex-1 h-0.5 mt-6 transition-colors duration-500 ${currentStep > 1 ? 'bg-matrix-green' : 'bg-light-border dark:bg-dark-border'}`} />
    <Step icon={FaFingerprint} label="Verificación" stepNumber={2} currentStep={currentStep} />
    <div className={`flex-1 h-0.5 mt-6 transition-colors duration-500 ${currentStep > 2 ? 'bg-matrix-green' : 'bg-light-border dark:bg-dark-border'}`} />
    <Step icon={FaCheckCircle} label="Finalizado" stepNumber={3} currentStep={currentStep} />
  </div>
);

export default StepIndicator;
