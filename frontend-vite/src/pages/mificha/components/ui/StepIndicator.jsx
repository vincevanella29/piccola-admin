// src/pages/employees_register/components/ui/StepIndicator.jsx
import React from 'react';

const StepIndicator = ({ currentStep }) => {
  // Pasos: 2 = Verificación, 3 = Final
  const steps = [1, 2, 3]; 
  const progress = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className="flex items-center gap-2 mt-1">
       <div className="h-1.5 w-24 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-matrix-green transition-all duration-500 ease-out" 
            style={{ width: `${progress}%` }}
          />
       </div>
       <span className="text-[10px] text-white/50 font-mono">
         {currentStep === 1 ? 'ID' : currentStep === 2 ? 'BIOMETRÍA' : 'LISTO'}
       </span>
    </div>
  );
};

export default StepIndicator;