import React, { useMemo } from 'react';
import { FaArrowRight, FaSpinner } from 'react-icons/fa';
import { formatRutUI, isValidRut, cleanRut, splitRut } from '../utils/rut.js';

const RutStep = ({ rut, setRut, onSubmit, isLoading, error }) => {
  const handleRutChange = (e) => {
    const formatted = formatRutUI(e.target.value);
    setRut(formatted);
  };
  const handleSubmit = (e) => { e.preventDefault(); onSubmit(); };

  const showInvalid = useMemo(() => {
    const cleaned = cleanRut(rut);
    const { dv } = splitRut(cleaned);
    if (!dv) return false; // no DV yet, no validation message
    return !isValidRut(rut);
  }, [rut]);

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center text-center p-4 animate-fadeIn">
      <h2 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">Ingresa tu RUT</h2>
      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1 mb-6">Usa el formato sin puntos y con guión.</p>
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        <input
          type="text"
          value={rut}
          onChange={handleRutChange}
          placeholder="12345678-9"
          className="w-full px-4 py-3 text-center text-base rounded-lg border-2 bg-light-background dark:bg-dark-background focus:ring-2 focus:outline-none transition-colors border-light-border dark:border-dark-border focus:border-matrix-green focus:ring-matrix-green/30"
          disabled={isLoading}
          autoFocus
        />
        <button
          type="submit"
          disabled={isLoading || !isValidRut(rut)}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-semibold text-white bg-matrix-green hover:bg-dark-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-matrix-green/20 hover:shadow-xl hover:shadow-matrix-green/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-matrix-green dark:focus:ring-offset-dark-surface"
        >
          {isLoading ? <FaSpinner className="animate-spin" /> : 'Verificar Identidad'}
          {!isLoading && <FaArrowRight />}
        </button>
      </form>
      {(error || showInvalid) && (
        <p className="mt-4 text-sm text-dark-error font-medium">
          {showInvalid ? 'RUT inválido. Revisa dígitos y dígito verificador.' : error}
        </p>
      )}
    </div>
  );
};

export default RutStep;
