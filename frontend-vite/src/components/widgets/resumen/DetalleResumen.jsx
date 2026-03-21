import React from 'react';

export default function DetalleResumen({ detalle, t }) {
  if (!detalle) return null;

  const d = detalle.details?.data || detalle.details || detalle.data || detalle;
  const clima = d?.clima;
  const isVenta = d.type === 'venta';

  return (
    <div className="p-2 text-light-text-primary dark:text-dark-text-primary text-sm">
      <h3 className="text-base font-bold mb-1">
        {isVenta ? t('analytics.Detalle Venta') : t('analytics.Detalle Gasto')}
      </h3>
      {detalle.dateLabel && (
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3">{detalle.dateLabel}{detalle.series ? ` · ${detalle.series}` : ''}</p>
      )}

      <div className="space-y-1.5">
        {[
          { label: t('analytics.Local'), value: d.local },
          { label: t('analytics.Fecha'), value: d.fecha },
          ...(isVenta ? [
            { label: t('analytics.Mesas'), value: d.mesas },
            { label: t('analytics.Personas'), value: d.personas },
            { label: t('analytics.Subtotal'), value: d.subtotal?.toLocaleString('es-CL') },
            { label: t('analytics.Descuentos'), value: d.desctos?.toLocaleString('es-CL') },
            { label: t('analytics.Total'), value: d.total?.toLocaleString('es-CL') },
          ] : [
            { label: t('analytics.Cuenta'), value: d.cuenta },
            { label: t('analytics.Descripcion'), value: d.descripcion },
            { label: t('analytics.Monto'), value: d.monto?.toLocaleString('es-CL') },
          ]),
        ].map((row, i) => (
          <div key={i} className="flex justify-between py-1.5 border-b border-light-border/15 dark:border-dark-border/15 last:border-0">
            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{row.label}</span>
            <span className="text-xs font-semibold">{row.value ?? '—'}</span>
          </div>
        ))}
      </div>

      {clima && (
        <div className="mt-3 pt-2 border-t border-light-border/20 dark:border-dark-border/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
            🌤️ {t('analytics.Clima')}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {[
              { l: t('analytics.Temperatura Max'), v: `${clima.temp_max}°C` },
              { l: t('analytics.Temperatura Min'), v: `${clima.temp_min}°C` },
              { l: t('analytics.Temperatura Media'), v: `${clima.temp_mean}°C` },
              { l: t('analytics.Precipitacion'), v: `${clima.precipitation_sum} mm` },
              { l: t('analytics.Lluvia'), v: clima.was_raining ? t('analytics.Si') : t('analytics.No') },
              { l: t('analytics.Nieve'), v: clima.was_snowing ? t('analytics.Si') : t('analytics.No') },
            ].map((row, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-light-text-secondary dark:text-dark-text-secondary">{row.l}</span>
                <span className="font-semibold">{row.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
