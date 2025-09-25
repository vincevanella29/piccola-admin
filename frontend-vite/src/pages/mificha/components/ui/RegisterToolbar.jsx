import React from 'react';
import { useTranslation } from 'react-i18next';

const Input = (props) => (
  <input
    {...props}
    className={`px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 focus:outline-none focus:ring-2 focus:ring-blue-500 ${props.className || ''}`}
  />
);

const Btn = ({ children, variant = 'primary', ...rest }) => {
  const base = 'px-3 py-2 rounded text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-300 dark:border-gray-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };
  return (
    <button {...rest} className={`${base} ${variants[variant] || variants.primary} ${rest.className || ''}`}>
      {children}
    </button>
  );
};

export default function RegisterToolbar({
  rut,
  setRut,
  verificarRut,
  iniciarVerificacion,
  validar,
  ready,
  loading,
  sessionId,
  needsProfileUpdate,
  adminNotice,
  employee,
  rutVerified,
  devices = [],
  selectedDeviceId,
  switchCamera,
  enumerateVideoDevices,
  restartCamera,
  hasFace,
  nextInstruction,
}) {
  const { t } = useTranslation();
  return (
    <div className="w-full flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex-1 flex flex-col gap-2 md:max-w-xl">
        <label className="text-sm font-medium">{t('employees.register.toolbar.rut_label')}</label>
        <div className="flex gap-2">
          <Input
            placeholder={t('employees.register.toolbar.rut_placeholder')}
            value={rut}
            onChange={(e) => setRut(e.target.value)}
          />
          <Btn onClick={verificarRut} disabled={loading || !rut}>{t('employees.register.toolbar.verify_rut', { defaultValue: 'Verificar RUT' })}</Btn>
          <Btn variant="ghost" onClick={iniciarVerificacion} disabled={!rutVerified || !ready}>{t('employees.register.toolbar.start_verification', { defaultValue: 'Iniciar verificación' })}</Btn>
          <Btn variant="ghost" onClick={validar} disabled={!sessionId}>{t('employees.register.toolbar.validate')}</Btn>
        </div>
        {needsProfileUpdate && (
          <div className="text-amber-600 dark:text-amber-400 text-sm">
            {adminNotice || t('employees.register.toolbar.profile_needed')}
          </div>
        )}

        {rutVerified && employee && (
          <div className="mt-1 text-sm text-green-700 dark:text-green-300">
            {t('employees.register.toolbar.welcome', { defaultValue: 'Bienvenido(a) {{name}}', name: `${employee.nombres || ''} ${employee.apellidopaterno || ''}`.trim() })}
            {employee.cargo ? ` • ${employee.cargo}${employee.seccion ? ' · ' + employee.seccion : ''}` : ''}
          </div>
        )}

        {/* Pasos intuitivos */}
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
          <ol className="list-decimal pl-5 space-y-1">
            <li>{t('employees.register.toolbar.step1')}</li>
            <li>{t('employees.register.toolbar.step2')}</li>
            <li>{t('employees.register.toolbar.step3')}</li>
            <li>{t('employees.register.toolbar.step4')}</li>
          </ol>
        </div>

        {/* Guía dinámica para posicionamiento y siguiente paso */}
        <div className="mt-1 text-xs">
          <span className={`inline-block px-2 py-1 rounded ${hasFace ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
            {hasFace ? t('employees.register.toolbar.face_ok', { defaultValue: 'Rostro detectado' }) : t('employees.register.toolbar.face_place', { defaultValue: 'Alinea tu rostro dentro del marco' })}
          </span>
          {nextInstruction && (
            <span className="ml-2 inline-block px-2 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              {t(`employees.register.toolbar.next_${nextInstruction}`, { defaultValue: {
                blink: 'Parpadea',
                turn_left: 'Mira a la izquierda',
                turn_right: 'Mira a la derecha',
              }[nextInstruction] })}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 md:flex-col md:items-end">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap">{t('employees.register.toolbar.models')}:</span>
          <span className="font-medium">{loading ? 'Cargando…' : (ready ? 'OK' : '—')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap">{t('employees.register.toolbar.session')}:</span>
          <span className="font-mono">{sessionId ? sessionId.slice(0, 6) + '…' : '—'}</span>
        </div>
        <div className="flex items-center gap-2 w-full md:w-64">
          <span className="whitespace-nowrap">{t('employees.register.toolbar.camera')}:</span>
          <select
            className="flex-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70"
            value={selectedDeviceId || ''}
            onChange={(e) => switchCamera && switchCamera(e.target.value)}
          >
            {(devices || []).map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
            ))}
          </select>
          <button
            type="button"
            title={t('employees.actions.refresh', { defaultValue: 'Refrescar' })}
            onClick={() => enumerateVideoDevices && enumerateVideoDevices()}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ⟳
          </button>
          <button
            type="button"
            title={t('employees.register.toolbar.restart', { defaultValue: 'Reiniciar cámara' })}
            onClick={() => restartCamera && restartCamera()}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ⟲
          </button>
        </div>
      </div>
    </div>
  );
}
