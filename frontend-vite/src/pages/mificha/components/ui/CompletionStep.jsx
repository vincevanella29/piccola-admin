import React from 'react';
import { FaCheckCircle, FaExclamationCircle, FaRedo } from 'react-icons/fa';

const CompletionStep = ({ message, onRetry, isError = false }) => (
  <div className="w-full flex flex-col items-center text-center p-8 animate-fadeIn">
    {isError ? (
      <FaExclamationCircle className="text-6xl text-dark-error mb-4" />
    ) : (
      <FaCheckCircle className="text-6xl text-matrix-green mb-4" />
    )}

    <h2 className="text-2xl font-semibold text-light-text-primary dark:text-dark-text-primary">
      {isError ? 'Ocurrió un Problema' : '¡Proceso Finalizado!'}
    </h2>

    <p className="mt-2 text-base text-light-text-secondary dark:text-dark-text-secondary">
      {message}
    </p>

    <button
      onClick={onRetry}
      className="mt-8 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-matrix-green hover:bg-dark-accent-hover transition-colors shadow-lg shadow-matrix-green/20"
    >
      <FaRedo /> {isError ? 'Intentar de Nuevo' : 'Registrar a Otro Empleado'}
    </button>
  </div>
);

export default CompletionStep;
