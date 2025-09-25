// File: frontend-vite/src/pages/mificha/components/tabs/sueldos/LiquidacionModal.jsx
import React from 'react';
import { DollarSign, LoaderCircle, Printer, X } from 'lucide-react';

// ===== Helpers (shared) =====
const toCLP = (n = 0) =>
  Number(n || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
const safeNum = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : Number(v || 0));
const monthName = (yyyymm) => {
  const s = String(yyyymm);
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  if (!y || !m) return s;
  return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, 1)
  );
};
const labelize = (k) =>
  String(k)
    .replace(/^_+/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

// ===== Small atoms reused inside modal =====
function Kpi({ label, value }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px]
                    border-light-border/30 bg-light-surface-secondary/40 
                    dark:border-dark-border/30 dark:bg-dark-surface-secondary/40">
      <span className="text-light-text-secondary dark:text-dark-text-secondary">{label}:</span>
      <strong className="text-light-text-primary dark:text-dark-text-primary">{value}</strong>
    </div>
  );
}
function TableList({ title, items = [], t }) {
  const filtered = items.filter(([, v]) => safeNum(v) !== 0);
  return (
    <div className="p-3 break-inside-avoid">
      {title && <div className="text-xs font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">{title}</div>}
      <div className="space-y-1">
        {filtered.length === 0 && (
          <div className="text-xs text-light-text-tertiary dark:text-dark-text-secondary/80">
            {t('mificha.sueldos.sin_movimientos')}
          </div>
        )}
        {filtered.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <span className="text-light-text-secondary dark:text-dark-text-secondary">{label}</span>
            <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">
              {toCLP(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Modal de Liquidación (separado, imprimible, respeta 64px header/footer; 84px en print) =====
export default function LiquidacionModal({ open, onClose, data, loading, error, t }) {
  if (!open) return null;

  const d = data || {};
  const trabajador = `${d?.nombre || ''} ${d?.apellido_paterno || ''} ${d?.apellido_materno || ''}`.trim();
  const periodoFmt = monthName(d?.periodo || '');
  const imponible = safeNum(d?.remuneracion_imponible);
  const noImponible = safeNum(d?.remuneracion_no_imponible);
  const brutoTotal = safeNum(d?.remuneracion_total);
  const descuentosLegales = safeNum(d?.descuentos_legales);
  const otrosDescuentos = safeNum(d?.otros_descuentos);
  const impuestos = safeNum(d?.impuestos) + safeNum(d?.impuestos_2);
  const liquido = safeNum(d?.sueldo_liquido_a_pago || d?.sueldo_liquido_mas_anticipo);

  const haberesImponibles = [
    [t('mificha.liquidacion.sueldo_base'), d?.sueldo_base || d?.sueldo_base_2],
    [t('mificha.liquidacion.gratificacion'), d?.gratificacion_mensual],
    [t('mificha.liquidacion.horas_extra_50'), d?.horas_extra_50],
    [t('mificha.liquidacion.horas_extra_100'), d?.hhs_extra_100 || d?.horas_extra_100],
    [t('mificha.liquidacion.bono_desempeno'), d?.['bono_desempeño_mensual']],
    [t('mificha.liquidacion.bono_productividad'), d?.bono_productividad],
    [t('mificha.liquidacion.incremento_domingo'), d?.incremento_30_domingo_trabajado],
    [t('mificha.liquidacion.mes_aviso'), d?.mes_de_aviso],
  ];
  const haberesNoImponibles = [
    [t('mificha.liquidacion.colacion'), d?.colacion],
    [t('mificha.liquidacion.movilizacion'), d?.movilizacion_m || d?.movilizacion],
    [t('mificha.liquidacion.asignacion_familiar_maternal'), d?.asignacion_familiar_y_maternal],
    [t('mificha.liquidacion.desgaste_herramientas'), d?.desgaste_herramientas],
    [t('mificha.liquidacion.asignacion_caja'), d?.asignacion_caja],
    [t('mificha.liquidacion.indemn_vacaciones'), d?.indemnizacion_por_vacaciones_pendientes],
  ];
  const descuentosTrabajador = [
    ['AFP', d?.afp],
    [t('mificha.liquidacion.fonasa_7'), d?.salud_7_fonasa],
    ['Isapre', d?.isapre],
    [t('mificha.liquidacion.isapre_sobre_7'), d?.isapre_sobre_7],
    [t('mificha.liquidacion.seguro_cesantia_trab'), d?.seguro_cesantia_trabajador],
    [t('mificha.liquidacion.impuestos'), d?.impuestos || d?.impuestos_2],
    [t('mificha.liquidacion.descuento_anticipo'), d?.descuento_anticipo],
    [t('mificha.liquidacion.otros_descuentos'), d?.descuento],
    [t('mificha.liquidacion.retencion_prestamo_sii'), d?.retencion_prestamo_solidario_sii],
  ];
  const aportesEmpleador = [
    [t('mificha.liquidacion.seguro_accidentes'), d?.seguro_accidentes_del_trabajo],
    [t('mificha.liquidacion.seguro_cesantia_emp'), d?.seguro_cesantia_empleador],
    [t('mificha.liquidacion.fondo_solidario'), d?.seguro_cesantia_fondo_solidario],
  ];

  // Dump de campos extra para “data completa”
  const shownKeys = new Set([
    'nombre','apellido_paterno','apellido_materno','periodo','rut_de_la_empresa','rut_del_trabajador','centro_costo',
    'sueldo_base','sueldo_base_2','gratificacion_mensual','horas_extra_50','hhs_extra_100','horas_extra_100',
    'bono_desempeño_mensual','bono_productividad','incremento_30_domingo_trabajado','mes_de_aviso',
    'colacion','movilizacion_m','movilizacion','asignacion_familiar_y_maternal','desgaste_herramientas','asignacion_caja',
    'indemnizacion_por_vacaciones_pendientes',
    'afp','salud_7_fonasa','isapre','isapre_sobre_7','seguro_cesantia_trabajador','impuestos','impuestos_2',
    'descuento_anticipo','descuento','retencion_prestamo_solidario_sii',
    'seguro_accidentes_del_trabajo','seguro_cesantia_empleador','seguro_cesantia_fondo_solidario',
    'remuneracion_imponible','remuneracion_no_imponible','remuneracion_total','descuentos_legales','otros_descuentos',
    'sueldo_liquido_a_pago','sueldo_liquido_mas_anticipo',
  ]);
  const extraEntries = Object.entries(d)
    .filter(([k, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object')
    .filter(([k]) => !k.startsWith('_') && !shownKeys.has(k));

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-light-text-primary/20 dark:bg-black/50 print:hidden"
        onClick={onClose}
      />

      {/* Printable sheet (solo la liquidación) */}
      <div
        className="relative z-[91] w-[min(1100px,95vw)] max-h-[80vh] overflow-hidden rounded-3xl
                   border border-light-border/20 dark:border-dark-border/20 
                   bg-light-surface dark:bg-dark-surface shadow-modal 
                   print:rounded-none print:border-0 print:shadow-none printable-liquidacion"
      >
        {/* Header fijo 64px (84px en print) */}
        <div
          className="print-header flex items-center justify-between gap-3 px-5 h-16 
                     border-b border-light-border/20 dark:border-dark-border/20 
                     bg-light-surface dark:bg-dark-surface"
        >
          <div className="flex items-center gap-3">
            <DollarSign className="text-light-accent dark:text-dark-accent" />
            <div>
              <div className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
                {t('mificha.liquidacion.titulo')} {periodoFmt}
              </div>
              <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                {t('mificha.liquidacion.empresa_rut')} {d?.rut_de_la_empresa ?? '—'} • {t('mificha.liquidacion.trabajador_rut')} {d?.rut_del_trabajador ?? '—'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg 
                         border border-light-border/30 dark:border-dark-border/30 
                         bg-light-surface hover:bg-light-surface-secondary/50 
                         dark:bg-dark-surface dark:hover:bg-dark-surface-secondary/50"
            >
              <Printer size={14} /> {t('mificha.liquidacion.imprimir')}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-light-surface hover:bg-light-surface-secondary/60 
                         dark:bg-dark-surface dark:hover:bg-dark-surface-secondary/60"
              aria-label={t('mificha.common.cerrar')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body scrollable (respeta header/footer). En print: sin límites, multipágina */}
        <div className="print-scroll overflow-y-auto bg-light-surface dark:bg-dark-surface" style={{ maxHeight: 'calc(80vh - 8rem)' }}>
          <div className="p-5 print:p-6 print:pt-[88px] print:pb-[88px]" style={{ minHeight: 'calc(100vh - 8rem)' }}>
            {loading && (
              <div className="flex items-center justify-center py-16">
                <LoaderCircle className="animate-spin text-light-accent dark:text-dark-accent" size={28} />
              </div>
            )}
            {!loading && error && (
              <div className="text-center text-light-error dark:text-dark-error font-semibold py-10">{error}</div>
            )}
            {!loading && !error && (
              <>
                {/* Encabezado trabajador */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5 break-inside-avoid">
                  <div className="rounded-lg p-3 border border-light-border/30 dark:border-dark-border/30 
                                  bg-light-surface dark:bg-dark-surface">
                    <div className="text-[11px] uppercase tracking-wide text-light-text-tertiary dark:text-dark-text-secondary/80">
                      {t('mificha.liquidacion.trabajador')}
                    </div>
                    <div className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{trabajador || '—'}</div>
                    <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                      {t('mificha.liquidacion.trabajador_rut')} {d?.rut_del_trabajador ?? '—'}
                    </div>
                  </div>
                  <div className="rounded-lg p-3 border border-light-border/30 dark:border-dark-border/30 
                                  bg-light-surface dark:bg-dark-surface">
                    <div className="text-[11px] uppercase tracking-wide text-light-text-tertiary dark:text-dark-text-secondary/80">
                      {t('mificha.liquidacion.periodo')}
                    </div>
                    <div className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{periodoFmt}</div>
                  </div>
                  <div className="rounded-lg p-3 border border-light-border/30 dark:border-dark-border/30 
                                  bg-light-surface dark:bg-dark-surface">
                    <div className="text-[11px] uppercase tracking-wide text-light-text-tertiary dark:text-dark-text-secondary/80">
                      {t('mificha.liquidacion.centro_costo')}
                    </div>
                    <div className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{d?.centro_costo || '—'}</div>
                  </div>
                </div>

                {/* Tablas principales */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Haberes */}
                  <section className="lg:col-span-2 rounded-xl border border-light-border/30 dark:border-dark-border/30 overflow-hidden
                                      bg-light-surface dark:bg-dark-surface break-inside-avoid">
                    <div className="px-4 py-2 text-sm font-bold 
                                    bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 
                                    text-light-text-primary dark:text-dark-text-primary">
                      {t('mificha.liquidacion.haberes')}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-light-border/20 dark:divide-dark-border/20">
                      <TableList title={t('mificha.liquidacion.imponibles')} items={haberesImponibles} t={t} />
                      <TableList title={t('mificha.liquidacion.no_imponibles')} items={haberesNoImponibles} t={t} />
                    </div>
                    <div className="px-4 py-2 text-xs flex flex-wrap gap-3 border-t border-light-border/20 dark:border-dark-border/20">
                      <Kpi label={t('mificha.liquidacion.remuneracion_imponible')} value={toCLP(imponible)} />
                      <Kpi label={t('mificha.liquidacion.remuneracion_no_imponible')} value={toCLP(noImponible)} />
                      <Kpi label={t('mificha.liquidacion.total_haberes')} value={toCLP(brutoTotal)} />
                    </div>
                  </section>

                  {/* Descuentos */}
                  <section className="rounded-xl border border-light-border/30 dark:border-dark-border/30 overflow-hidden
                                      bg-light-surface dark:bg-dark-surface break-inside-avoid">
                    <div className="px-4 py-2 text-sm font-bold 
                                    bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 
                                    text-light-text-primary dark:text-dark-text-primary">
                      {t('mificha.liquidacion.descuentos')}
                    </div>
                    <TableList items={descuentosTrabajador} t={t} />
                    <div className="px-4 py-2 text-xs flex flex-wrap gap-3 border-t border-light-border/20 dark:border-dark-border/20">
                      <Kpi label={t('mificha.liquidacion.desc_legales_sistema')} value={toCLP(descuentosLegales)} />
                      <Kpi label={t('mificha.liquidacion.otros_desc')} value={toCLP(otrosDescuentos)} />
                      <Kpi label={t('mificha.liquidacion.impuestos')} value={toCLP(impuestos)} />
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px]
                                      border-light-accent/40 bg-light-accent/10 
                                      dark:border-dark-accent/40 dark:bg-dark-accent/10">
                        <span className="text-light-text-secondary dark:text-dark-text-secondary">{t('mificha.liquidacion.liquido_pago')}:</span>
                        <strong className="text-light-text-primary dark:text-dark-text-primary">{toCLP(liquido)}</strong>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Aportes empleador */}
                <section className="rounded-xl border border-light-border/30 dark:border-dark-border/30 overflow-hidden mt-4
                                    bg-light-surface dark:bg-dark-surface break-inside-avoid">
                  <div className="px-4 py-2 text-sm font-bold bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 
                                  text-light-text-primary dark:text-dark-text-primary">
                    {t('mificha.liquidacion.aportes_empleador')}
                  </div>
                  <TableList items={aportesEmpleador} t={t} />
                </section>

                {/* Dump de todos los campos (para asegurar data completa) */}
                {extraEntries.length > 0 && (
                  <section className="mt-4 rounded-xl border border-light-border/30 dark:border-dark-border/30 overflow-hidden
                                      bg-light-surface dark:bg-dark-surface break-inside-avoid">
                    <div className="px-4 py-2 text-sm font-bold bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 
                                    text-light-text-primary dark:text-dark-text-primary">
                      {t('mificha.liquidacion.todos_campos') ?? 'Todos los campos'}
                    </div>
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      {extraEntries.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <span className="text-light-text-secondary dark:text-dark-text-secondary">{labelize(k)}</span>
                          <span className="font-semibold text-light-text-primary dark:text-dark-text-primary break-words">
                            {typeof v === 'number' ? v.toLocaleString('es-CL') : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Nota */}
                <div className="text-[11px] text-light-text-tertiary dark:text-dark-text-secondary/80 mt-3">
                  {t('mificha.liquidacion.nota_pdf')}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer fijo 64px (84px en print) */}
        <div className="print-footer h-16 px-5 flex items-center justify-between border-t border-light-border/20 dark:border-dark-border/20 
                        text-[11px] text-light-text-secondary dark:text-dark-text-secondary 
                        bg-light-surface dark:bg-dark-surface">
          <div>{t('common.copy')}</div>
          <div>{t('mificha.liquidacion.footer_politicas')}</div>
        </div>
      </div>

      {/* Estilos de impresión: SOLO la liquidación, multipágina, +20px header/footer */}
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          html, body { background: white !important; }
          /* Oculta todo menos la liquidación */
          body * { visibility: hidden !important; }
          .printable-liquidacion, .printable-liquidacion * { visibility: visible !important; }

          /* Permite que el contenido fluya en múltiples páginas */
          .printable-liquidacion { position: static !important; width: auto !important; height: auto !important; overflow: visible !important; }

          /* Aumenta header/footer a 84px (+20px) y reserva espacio con padding en el body */
          .print-header { height: 84px !important; }
          .print-footer { height: 84px !important; }
          .print-scroll { max-height: none !important; overflow: visible !important; }
          .print-scroll > .p-5, .print-scroll > .print\\:p-6 { min-height: auto !important; }

          /* Evita cortes feos dentro de tarjetas/secciones */
          .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }

          /* Márgenes internos para no superponer header/footer */
          .print-scroll > .print\\:p-6, .print-scroll > .p-5 {
            padding-top: 88px !important;
            padding-bottom: 88px !important;
          }
        }
      `}</style>
    </div>
  );
}
