// src/pages/delivery/DeliveryFinance.jsx
// Finance dashboard — render only, logic in useDeliveryFinance hook
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FaChartLine, FaFileInvoiceDollar, FaPlus, FaSync, FaSpinner,
  FaCheck, FaDownload, FaCalendarAlt, FaTrash,
  FaMoneyBillWave, FaPercentage, FaReceipt,
} from 'react-icons/fa';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import useDeliveryFinance from '../../hooks/delivery/useDeliveryFinance';

const fmt = (n) => `$${(n || 0).toLocaleString('es-CL')}`;

// ── Summary Card ─────────────────────────────────────────────
const SummaryCard = ({ label, value, icon: Icon, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="p-4 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 hover:shadow-lg transition-shadow"
  >
    <div className="flex items-center gap-2 mb-2">
      <div className={`p-2 rounded-xl ${color.bg}`}>
        <Icon size={14} className={color.text} />
      </div>
      <span className="text-[10px] font-semibold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider">
        {label}
      </span>
    </div>
    <p className={`text-xl font-bold font-mono ${color.text}`}>{value}</p>
  </motion.div>
);

// ── Closing Row ──────────────────────────────────────────────
const STATUS_STYLES = {
  draft: { text: 'text-amber-500', bg: 'bg-amber-500/10' },
  confirmed: { text: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  paid: { text: 'text-green-500', bg: 'bg-green-500/10' },
};

const ClosingRow = ({ closing, onConfirm, onPay, onDelete }) => {
  const style = STATUS_STYLES[closing.status] || STATUS_STYLES.draft;
  return (
    <tr className="border-b border-light-border/5 dark:border-dark-border/5 hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/30 transition-colors">
      <td className="py-2.5 px-2 font-mono text-light-text-primary dark:text-dark-text-primary">
        {closing.period_from?.slice(0, 10)} → {closing.period_to?.slice(0, 10)}
      </td>
      <td className="text-right px-2 font-mono text-light-text-secondary dark:text-dark-text-secondary">{closing.total_orders}</td>
      <td className="text-right px-2 font-mono text-light-text-secondary dark:text-dark-text-secondary">{fmt(closing.total_subtotal)}</td>
      <td className="text-right px-2 font-mono font-bold text-matrix-green">{fmt(closing.total_commission)}</td>
      <td className="text-center px-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${style.bg} ${style.text}`}>
          {closing.status}
        </span>
      </td>
      <td className="text-right px-2">
        <div className="flex items-center justify-end gap-1">
          {closing.status === 'draft' && (
            <>
              <button onClick={() => onConfirm(closing._id)} className="p-1.5 rounded-lg hover:bg-cyan-500/10 text-cyan-500 transition-colors" title="Confirmar">
                <FaCheck size={10} />
              </button>
              <button onClick={() => onDelete(closing._id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors" title="Eliminar">
                <FaTrash size={10} />
              </button>
            </>
          )}
          {closing.status === 'confirmed' && (
            <button onClick={() => onPay(closing._id)} className="p-1.5 rounded-lg hover:bg-green-500/10 text-green-500 transition-colors" title="Marcar pagado">
              <FaMoneyBillWave size={10} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// ── Entry Item ───────────────────────────────────────────────
const EntryItem = ({ entry, onDelete }) => (
  <div className="flex items-center justify-between p-3 rounded-xl bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50 transition-colors">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-xl ${entry.type === 'payment' ? 'bg-green-500/10' : 'bg-cyan-500/10'}`}>
        {entry.type === 'payment'
          ? <FaMoneyBillWave size={12} className="text-green-500" />
          : <FaReceipt size={12} className="text-cyan-500" />
        }
      </div>
      <div>
        <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">{entry.description || entry.type}</p>
        <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">
          {entry.date?.slice(0, 10)} {entry.reference && `• ${entry.reference}`}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <span className="font-mono font-bold text-sm text-green-500">{fmt(entry.amount)}</span>
      <button
        onClick={() => { if (confirm('¿Eliminar?')) onDelete(entry._id); }}
        className="p-1.5 rounded-lg hover:bg-red-500/10 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-red-500 transition-colors"
      >
        <FaTrash size={10} />
      </button>
    </div>
  </div>
);

// ── Main Component ───────────────────────────────────────────
const DeliveryFinance = ({ appState }) => {
  const { t } = useTranslation();
  const api = useDeliveryFinance(appState, t);

  const [closingFrom, setClosingFrom] = useState('');
  const [closingTo, setClosingTo] = useState('');
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryForm, setEntryForm] = useState({ type: 'payment', amount: '', description: '', reference: '' });
  const [entrySaving, setEntrySaving] = useState(false);

  useEffect(() => {
    api.fetchProviders();
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 7);
    setClosingTo(to.toISOString().split('T')[0]);
    setClosingFrom(from.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (api.selectedSlug) api.fetchFinanceData();
  }, [api.selectedSlug]);

  const handleCreateEntry = async () => {
    if (!entryForm.amount) return;
    setEntrySaving(true);
    const ok = await api.handleCreateEntry({ ...entryForm, amount: parseInt(entryForm.amount) });
    if (ok) {
      setShowEntryForm(false);
      setEntryForm({ type: 'payment', amount: '', description: '', reference: '' });
    }
    setEntrySaving(false);
  };

  const commConfig = api.summary?.commissions_config || {};
  const inputCls = "px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 transition-all";

  return (
    <motion.div
      className="w-full max-w-[1400px] mx-auto p-4 sm:p-6 min-h-screen pb-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-futurist font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-3">
            <FaChartLine className="text-matrix-green" />
            Finanzas
          </h1>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
            Comisiones, cierres y pagos de la plataforma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={api.selectedSlug}
            onChange={(e) => api.setSelectedSlug(e.target.value)}
            className={inputCls}
          >
            {api.providers.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
          <button
            onClick={() => api.fetchFinanceData()}
            className="p-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary transition-colors border border-light-border/10 dark:border-dark-border/10"
          >
            {api.loading ? <FaSpinner size={14} className="animate-spin" /> : <FaSync size={14} />}
          </button>
        </div>
      </div>

      {api.loading && !api.summary ? (
        <div className="flex items-center justify-center py-20">
          <FaSpinner size={24} className="animate-spin text-matrix-green" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Comisiones Acumuladas" value={fmt(api.summary?.total_commissions)} icon={FaPercentage}
              color={{ text: 'text-amber-500', bg: 'bg-amber-500/10' }} delay={0} />
            <SummaryCard label="Pagos Registrados" value={fmt(api.summary?.total_payments)} icon={FaMoneyBillWave}
              color={{ text: 'text-green-500', bg: 'bg-green-500/10' }} delay={0.05} />
            <SummaryCard label="Ajustes" value={fmt(api.summary?.total_adjustments)} icon={FaReceipt}
              color={{ text: 'text-cyan-500', bg: 'bg-cyan-500/10' }} delay={0.1} />
            <SummaryCard label="Saldo Pendiente" value={fmt(api.summary?.balance)} icon={FaFileInvoiceDollar}
              color={{ text: api.summary?.balance > 0 ? 'text-red-500' : 'text-green-500', bg: api.summary?.balance > 0 ? 'bg-red-500/10' : 'bg-green-500/10' }} delay={0.15} />
          </div>

          {/* Commission Rates */}
          <div className="p-5 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20">
            <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary mb-3">
              Tasas de Comisión Activas
            </h3>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 font-mono font-bold">Delivery: {commConfig.delivery_pct || 0}%</span>
              <span className="px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-500 font-mono font-bold">Plataforma: {commConfig.platform_pct || 0}%</span>
              <span className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-500 font-mono font-bold">Medio Pago: {commConfig.payment_pct || 0}%</span>
              {commConfig.closing_day && (
                <span className="px-3 py-1.5 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary text-xs font-medium">
                  Cierre: {commConfig.closing_day}
                </span>
              )}
              {commConfig.notes && (
                <span className="px-3 py-1.5 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-tertiary dark:text-dark-text-tertiary text-xs italic">
                  {commConfig.notes}
                </span>
              )}
            </div>
          </div>

          {/* Closing Generator */}
          <div className="p-5 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20">
            <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary mb-3 flex items-center gap-2">
              <FaCalendarAlt size={12} className="text-matrix-green" /> Generar Cierre
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary mb-1 font-semibold">Desde</label>
                <input type="date" value={closingFrom} onChange={(e) => setClosingFrom(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary mb-1 font-semibold">Hasta</label>
                <input type="date" value={closingTo} onChange={(e) => setClosingTo(e.target.value)} className={inputCls} />
              </div>
              <button
                onClick={() => api.fetchPreview(closingFrom, closingTo)}
                disabled={api.previewLoading}
                className="px-4 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary text-sm font-medium text-light-text-primary dark:text-dark-text-primary transition-colors border border-light-border/10 dark:border-dark-border/10"
              >
                {api.previewLoading ? <FaSpinner size={12} className="animate-spin" /> : 'Previsualizar'}
              </button>
              <button
                onClick={() => window.open(api.getExportUrl(closingFrom, closingTo), '_blank')}
                className="px-4 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary text-sm font-medium text-light-text-primary dark:text-dark-text-primary transition-colors flex items-center gap-1.5 border border-light-border/10 dark:border-dark-border/10"
              >
                <FaDownload size={10} /> CSV
              </button>
            </div>

            {/* Preview */}
            <AnimatePresence>
              {api.preview && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="mt-4 p-4 rounded-xl bg-matrix-green/5 border border-matrix-green/20"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                    <div>
                      <span className="text-light-text-tertiary dark:text-dark-text-tertiary text-xs">Órdenes</span>
                      <p className="font-bold font-mono text-light-text-primary dark:text-dark-text-primary">{api.preview.total_orders}</p>
                    </div>
                    <div>
                      <span className="text-light-text-tertiary dark:text-dark-text-tertiary text-xs">Subtotal</span>
                      <p className="font-bold font-mono text-light-text-primary dark:text-dark-text-primary">{fmt(api.preview.total_subtotal)}</p>
                    </div>
                    <div>
                      <span className="text-light-text-tertiary dark:text-dark-text-tertiary text-xs">Delivery Fees</span>
                      <p className="font-bold font-mono text-light-text-primary dark:text-dark-text-primary">{fmt(api.preview.total_delivery_fees)}</p>
                    </div>
                    <div>
                      <span className="text-light-text-tertiary dark:text-dark-text-tertiary text-xs">Total Comisión</span>
                      <p className="font-bold font-mono text-matrix-green">{fmt(api.preview.total_commission)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs mb-3">
                    <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-500 font-mono">Delivery: {fmt(api.preview.commission_delivery)}</span>
                    <span className="px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-500 font-mono">Plataforma: {fmt(api.preview.commission_platform)}</span>
                    <span className="px-2 py-1 rounded-lg bg-purple-500/10 text-purple-500 font-mono">Pago: {fmt(api.preview.commission_payment)}</span>
                  </div>
                  <button
                    onClick={() => api.handleGenerateClosing(closingFrom, closingTo)}
                    className="px-5 py-2 rounded-xl text-sm font-bold bg-matrix-green text-white hover:bg-matrix-green/90 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <FaCheck size={10} /> Confirmar Cierre
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Closings Table */}
          <div className="p-5 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20">
            <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary mb-3">Cierres</h3>
            {api.closings.length === 0 ? (
              <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary text-center py-8">No hay cierres aún</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-light-text-tertiary dark:text-dark-text-tertiary border-b border-light-border/10 dark:border-dark-border/10">
                      <th className="text-left py-2 px-2 font-semibold">Período</th>
                      <th className="text-right px-2 font-semibold">Órdenes</th>
                      <th className="text-right px-2 font-semibold">Subtotal</th>
                      <th className="text-right px-2 font-semibold">Com. Total</th>
                      <th className="text-center px-2 font-semibold">Estado</th>
                      <th className="text-right px-2 font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {api.closings.map((c) => (
                      <ClosingRow
                        key={c._id}
                        closing={c}
                        onConfirm={(id) => api.handleClosingStatus(id, 'confirmed')}
                        onPay={(id) => api.handleClosingStatus(id, 'paid')}
                        onDelete={(id) => { if (confirm('¿Eliminar este cierre?')) api.handleDeleteClosing(id); }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payments Section */}
          <div className="p-5 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">Pagos y Ajustes</h3>
              <button
                onClick={() => setShowEntryForm(!showEntryForm)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-matrix-green text-white hover:bg-matrix-green/90 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <FaPlus size={8} /> Agregar
              </button>
            </div>

            <AnimatePresence>
              {showEntryForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-4 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/10 dark:border-dark-border/10"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <select value={entryForm.type} onChange={(e) => setEntryForm({ ...entryForm, type: e.target.value })} className={inputCls}>
                      <option value="payment">Pago</option>
                      <option value="adjustment">Ajuste</option>
                    </select>
                    <input type="number" placeholder="Monto CLP" value={entryForm.amount}
                      onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
                      className={`${inputCls} font-mono`} />
                    <input type="text" placeholder="Descripción" value={entryForm.description}
                      onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
                      className={inputCls} />
                    <input type="text" placeholder="Referencia" value={entryForm.reference}
                      onChange={(e) => setEntryForm({ ...entryForm, reference: e.target.value })}
                      className={inputCls} />
                    <button
                      onClick={handleCreateEntry}
                      disabled={entrySaving || !entryForm.amount}
                      className="px-4 py-2 rounded-xl bg-matrix-green text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 hover:bg-matrix-green/90 transition-colors"
                    >
                      {entrySaving ? <FaSpinner size={10} className="animate-spin" /> : <FaCheck size={10} />} Guardar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {api.entries.length === 0 ? (
              <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary text-center py-8">No hay pagos registrados</p>
            ) : (
              <div className="space-y-2">
                {api.entries.map((e) => (
                  <EntryItem key={e._id} entry={e} onDelete={api.handleDeleteEntry} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ToastContainer
        position="top-right"
        autoClose={3000}
        className="mt-16 sm:mt-20"
        toastClassName="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-neon rounded-lg"
      />
    </motion.div>
  );
};

export default DeliveryFinance;

export const pageMetadata = {
  path: '/app/delivery/finance',
  label: 'delivery.finance_label',
  category: 'delivery.category',
  minRoleLevel: 3,
  maxRoleLevel: 4,
  order: 5,
  locations: ['sidebar'],
  description: 'delivery.finance_description',
  icon: 'FaChartLine',
  isSearchable: true,
};
