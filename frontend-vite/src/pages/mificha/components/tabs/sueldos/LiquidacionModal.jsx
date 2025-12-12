// File: frontend-vite/src/pages/mificha/components/tabs/sueldos/LiquidacionModal.jsx
import React, { useState } from 'react';
import { 
  DollarSign, 
  LoaderCircle, 
  Printer, 
  X, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  FileText 
} from 'lucide-react';
import { motion } from 'framer-motion';

// ===== Helpers =====
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

// ===== Componentes Atómicos =====

function Kpi({ label, value, highlight = false }) {
  return (
    <div className={`
      flex flex-col justify-center px-3 py-2 rounded-xl border text-xs
      ${highlight 
        ? 'bg-light-accent/10 border-light-accent/30 dark:bg-dark-accent/10 dark:border-dark-accent/30' 
        : 'bg-light-surface-secondary/30 border-light-border/30 dark:bg-dark-surface-secondary/30 dark:border-dark-border/30'}
    `}>
      <span className="text-light-text-secondary dark:text-dark-text-secondary mb-1 text-[10px] uppercase tracking-wider">
        {label}
      </span>
      <strong className={`text-sm ${highlight ? 'text-light-accent dark:text-dark-accent' : 'text-light-text-primary dark:text-dark-text-primary'} font-mono tabular-nums`}>
        {value}
      </strong>
    </div>
  );
}

function TableRow({ label, value, isTotal = false }) {
  if (safeNum(value) === 0 && !isTotal) return null;
  return (
    <div className={`
      flex items-center justify-between py-1.5 px-2 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors
      ${isTotal ? 'border-t border-light-border/50 dark:border-dark-border/50 mt-1 pt-2 font-bold' : 'text-xs'}
    `}>
      <span className={`${isTotal ? 'text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
        {label}
      </span>
      <span className={`font-mono tabular-nums ${isTotal ? 'text-sm' : 'font-medium text-light-text-primary dark:text-dark-text-primary'}`}>
        {toCLP(value)}
      </span>
    </div>
  );
}

function SectionCard({ title, children, className = '' }) {
  return (
    <div className={`
      rounded-xl border border-light-border/30 dark:border-dark-border/30 
      bg-light-surface dark:bg-dark-surface overflow-hidden break-inside-avoid ${className}
    `}>
      <div className="px-4 py-2.5 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 
                      border-b border-light-border/20 dark:border-dark-border/20">
        <h3 className="text-xs font-bold uppercase tracking-wider text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
          {title}
        </h3>
      </div>
      <div className="p-3">
        {children}
      </div>
    </div>
  );
}

// ===== Modal Principal =====
export default function LiquidacionModal({ open, onClose, data, loading, error, t }) {
  const [showExtra, setShowExtra] = useState(false);

  // Si no está abierto, retornamos null, pero AnimatePresence lo manejará desde el padre idealmente.
  // Aquí lo manejamos internamente para simplicidad si el padre hace render condicional.
  if (!open) return null;

  const d = data || {};
  const trabajador = `${d?.nombre || ''} ${d?.apellido_paterno || ''} ${d?.apellido_materno || ''}`.trim();
  const periodoFmt = monthName(d?.periodo || '');
  
  // Cálculos y valores seguros
  const imponible = safeNum(d?.remuneracion_imponible);
  const noImponible = safeNum(d?.remuneracion_no_imponible);
  const brutoTotal = safeNum(d?.remuneracion_total);
  const descuentosLegales = safeNum(d?.descuentos_legales);
  const otrosDescuentos = safeNum(d?.otros_descuentos);
  const impuestos = safeNum(d?.impuestos) + safeNum(d?.impuestos_2);
  const liquido = safeNum(d?.sueldo_liquido_a_pago || d?.sueldo_liquido_mas_anticipo);

  // Total descuentos reales según la liquidación: haberes totales - líquido a pago
  const totalDescuentos = Math.max(0, brutoTotal - liquido);

  // Arrays de datos
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
    [t('mificha.liquidacion.impuestos'), impuestos], // Usamos el calculado arriba
    [t('mificha.liquidacion.descuento_anticipo'), d?.descuento_anticipo],
    [t('mificha.liquidacion.otros_descuentos'), d?.descuento],
    [t('mificha.liquidacion.retencion_prestamo_sii'), d?.retencion_prestamo_solidario_sii],
  ];

  const aportesEmpleador = [
    [t('mificha.liquidacion.seguro_accidentes'), d?.seguro_accidentes_del_trabajo],
    [t('mificha.liquidacion.seguro_cesantia_emp'), d?.seguro_cesantia_empleador],
    [t('mificha.liquidacion.fondo_solidario'), d?.seguro_cesantia_fondo_solidario],
  ];

  // Filtro de campos extra
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop con Blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-light-text-primary/20 dark:bg-black/60 backdrop-blur-sm print:hidden"
          onClick={onClose}
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative z-[91] w-full max-w-5xl h-auto sm:h-[85vh] max-h-[90vh] flex flex-col
                     rounded-2xl shadow-2xl overflow-hidden
                     bg-light-surface dark:bg-dark-surface 
                     border border-light-border/20 dark:border-dark-border/20
                     printable-liquidacion"
        >
          {/* === HEADER (Sticky) === */}
          <div className="flex-none h-16 px-6 flex items-center justify-between
                          bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur-md
                          border-b border-light-border/20 dark:border-dark-border/20
                          print-header">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-light-accent/10 dark:bg-dark-accent/10">
                <FileText className="text-light-accent dark:text-dark-accent" size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary leading-tight">
                  {t('mificha.liquidacion.titulo')}
                </h2>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  {periodoFmt} • <span className="uppercase">{d?.rut_del_trabajador}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all
                           bg-light-text-primary text-light-surface hover:bg-light-text-primary/90
                           dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                <Download size={14} />
                {t('mificha.liquidacion.imprimir') || 'Descargar PDF'}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-light-text-secondary hover:text-light-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* === BODY (Scrollable) === */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden print-scroll bg-[#F9FAFB] dark:bg-[#0a0a0a]">
            <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-full print:p-0 print:pt-4">
              
              {loading && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <LoaderCircle className="animate-spin text-light-accent dark:text-dark-accent" size={32} />
                  <span className="text-sm text-light-text-tertiary">Cargando liquidación...</span>
                </div>
              )}

              {!loading && error && (
                <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-600 dark:bg-red-900/10 dark:border-red-800 dark:text-red-400 text-center text-sm font-medium">
                  {error}
                </div>
              )}

              {!loading && !error && (
                <div className="space-y-6">
                  {/* Tarjeta Resumen Encabezado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 break-inside-avoid">
                    <div className="p-4 rounded-xl border border-light-border/30 bg-white dark:bg-dark-surface-secondary/20 dark:border-dark-border/30 shadow-sm">
                      <div className="text-[10px] uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-secondary/70 mb-1">Empresa</div>
                      <div className="text-sm font-semibold">{d?.rut_de_la_empresa ?? '—'}</div>
                      <div className="text-xs text-light-text-secondary">RUT Empresa</div>
                    </div>
                    <div className="p-4 rounded-xl border border-light-border/30 bg-white dark:bg-dark-surface-secondary/20 dark:border-dark-border/30 shadow-sm">
                      <div className="text-[10px] uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-secondary/70 mb-1">Colaborador</div>
                      <div className="text-sm font-semibold">{trabajador || '—'}</div>
                      <div className="text-xs text-light-text-secondary">{d?.centro_costo || '—'}</div>
                    </div>
                  </div>

                  {/* KPIs Principales */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 break-inside-avoid">
                     <Kpi label="Total Haberes" value={toCLP(brutoTotal)} />
                     <Kpi label="Desc. Legales" value={toCLP(descuentosLegales)} />
                     <Kpi label="Impuestos" value={toCLP(impuestos)} />
                     <Kpi label="Líquido a Pago" value={toCLP(liquido)} highlight={true} />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Columna Izquierda: Haberes */}
                    <div className="space-y-6">
                      <SectionCard title={t('mificha.liquidacion.haberes')}>
                        <div className="space-y-4">
                           <div>
                              <h4 className="text-[11px] font-semibold text-light-text-tertiary mb-2 uppercase">Imponibles</h4>
                              <div className="space-y-0.5">
                                {haberesImponibles.map(([l, v]) => <TableRow key={l} label={l} value={v} />)}
                                <TableRow label="Total Imponible" value={imponible} isTotal />
                              </div>
                           </div>
                           <div className="border-t border-dashed border-light-border/30 dark:border-dark-border/30 pt-3">
                              <h4 className="text-[11px] font-semibold text-light-text-tertiary mb-2 uppercase">No Imponibles</h4>
                              <div className="space-y-0.5">
                                {haberesNoImponibles.map(([l, v]) => <TableRow key={l} label={l} value={v} />)}
                                <TableRow label="Total No Imponible" value={noImponible} isTotal />
                              </div>
                           </div>
                        </div>
                      </SectionCard>
                    </div>

                    {/* Columna Derecha: Descuentos */}
                    <div className="space-y-6">
                      <SectionCard title={t('mificha.liquidacion.descuentos')}>
                         <div className="space-y-0.5">
                            {descuentosTrabajador.map(([l, v]) => <TableRow key={l} label={l} value={v} />)}
                            <div className="pt-3 mt-2 border-t border-light-border/20 dark:border-dark-border/20">
                              <div className="flex justify-between items-end">
                                <span className="text-xs text-light-text-secondary">Total Descuentos</span>
                                <span className="text-sm font-bold text-light-error dark:text-red-400 font-mono tabular-nums">
                                  - {toCLP(totalDescuentos)}
                                </span>
                              </div>
                            </div>
                         </div>
                      </SectionCard>

                      <SectionCard title={t('mificha.liquidacion.aportes_empleador')} className="opacity-80">
                         <div className="space-y-0.5">
                            {aportesEmpleador.map(([l, v]) => <TableRow key={l} label={l} value={v} />)}
                         </div>
                      </SectionCard>
                    </div>
                  </div>

                  {/* Líquido Final Grande */}
                  <div className="break-inside-avoid p-6 rounded-xl bg-gradient-to-r from-light-accent/5 to-transparent dark:from-dark-accent/10 border border-light-accent/20 dark:border-dark-accent/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-light-accent dark:text-dark-accent">
                      <DollarSign size={24} />
                      <span className="text-lg font-bold uppercase tracking-tight">{t('mificha.liquidacion.liquido_pago')}</span>
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-light-text-primary dark:text-white font-mono tabular-nums tracking-tighter">
                      {toCLP(liquido)}
                    </div>
                  </div>

                  {/* Sección Colapsable "Datos Técnicos" */}
                  {extraEntries.length > 0 && (
                    <div className="break-inside-avoid print:hidden">
                      <button 
                        onClick={() => setShowExtra(!showExtra)}
                        className="flex items-center gap-2 text-xs font-medium text-light-text-tertiary hover:text-light-text-primary transition-colors mx-auto"
                      >
                        {showExtra ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                        {showExtra ? 'Ocultar detalles técnicos' : 'Ver todos los campos técnicos'}
                      </button>
                      
                      {showExtra && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="mt-4 p-4 rounded-lg bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/10 border border-light-border/10 text-[10px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-light-text-secondary font-mono"
                        >
                          {extraEntries.map(([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-white/5 py-1">
                              <span className="opacity-70">{labelize(k)}</span>
                              <span>{String(v)}</span>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  )}

                  <div className="text-[10px] text-center text-light-text-tertiary max-w-2xl mx-auto pt-6 pb-2">
                    {t('mificha.liquidacion.nota_pdf')} • Documento generado digitalmente por Vanellix Platform.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* === FOOTER (Sticky) === */}
          <div className="flex-none h-14 px-6 flex items-center justify-between
                          bg-light-surface dark:bg-dark-surface
                          border-t border-light-border/20 dark:border-dark-border/20
                          text-[11px] text-light-text-tertiary print-footer">
             <span>{t('common.copy')} © {new Date().getFullYear()}</span>
             <span className="hidden sm:block text-right">{d?.rut_de_la_empresa}</span>
          </div>
        </motion.div>

        {/* ESTILOS DE IMPRESIÓN PRO */}
        <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          /* Limpieza general */
          html, body { background: white !important; color: black !important; height: auto !important; overflow: visible !important; }
          body * { visibility: hidden !important; }
          
          /* Mostrar solo el modal */
          .printable-liquidacion, .printable-liquidacion * { visibility: visible !important; }
          
          /* Resetear posición para impresión */
          .printable-liquidacion {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
            background: white !important;
          }
          
          /* Ajustar header y footer para papel */
          .print-header { 
            position: static !important; 
            border-bottom: 2px solid #000 !important; 
            background: white !important; 
            color: black !important;
            padding: 20px 0 !important;
          }
          .print-footer { 
             position: static !important;
             border-top: 1px solid #ddd !important;
             color: #666 !important;
             margin-top: 20px !important;
          }
          
          /* Scroll reset */
          .print-scroll { 
            overflow: visible !important; 
            height: auto !important; 
            background: white !important;
          }
          
          /* Colores oscuros a negro para tinta */
          .text-light-text-secondary, .text-light-text-tertiary { color: #444 !important; }
          strong, h2, h3, h4 { color: #000 !important; }
          
          /* Evitar cortes de página en tarjetas */
          .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
          
          /* Ocultar botones y scrollbars */
          button, ::-webkit-scrollbar { display: none !important; }
        }
      `}</style>
      </div>
  );
}