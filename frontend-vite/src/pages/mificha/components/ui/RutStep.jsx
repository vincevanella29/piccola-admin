// src/pages/employees_register/components/ui/RutStep.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { formatRutUI, isValidRut } from '../utils/rut';

const RutStep = ({ rut, setRut, onSubmit, isLoading, error }) => {
  const { t } = useTranslation();

  const handleChange = (e) => setRut(formatRutUI(e.target.value));
  const handleSubmit = (e) => { e.preventDefault(); onSubmit(); };
  const isValid = isValidRut(rut);

  return (
    <div className="w-full max-w-sm mx-auto animate-fadeIn">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        
        <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary ml-1">
                {t('register.rut_label', 'RUT Empleado')}
            </label>
            <input
                type="text"
                value={rut}
                onChange={handleChange}
                placeholder="12.345.678-9"
                className="w-full px-4 py-4 text-center text-xl font-mono tracking-wide rounded-xl 
                           bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 
                           border-2 border-transparent focus:border-matrix-green focus:bg-light-surface dark:focus:bg-dark-surface 
                           text-light-text-primary dark:text-white 
                           outline-none transition-all placeholder:opacity-30"
                disabled={isLoading}
                autoFocus
            />
            {error && (
                <p className="text-xs text-light-error dark:text-dark-error font-medium text-center mt-2 animate-shake">
                    {error}
                </p>
            )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !isValid}
          className="w-full py-4 rounded-xl font-bold text-white bg-matrix-green hover:bg-light-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-matrix-green/20 flex items-center justify-center gap-2 group"
        >
          {isLoading ? <LoaderCircle className="animate-spin" /> : (
            <>
                <span>{t('register.btn_continue', 'Continuar')}</span>
                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={18} />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default RutStep;