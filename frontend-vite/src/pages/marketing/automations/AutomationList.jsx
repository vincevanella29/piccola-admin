// src/pages/marketing/automations/AutomationList.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaRobot, FaTrash, FaClock, FaToggleOn, FaToggleOff, FaPen } from 'react-icons/fa';

const DELAY_UNITS = [
  { value: 'minutes', label: 'Minutos', factor: 1 },
  { value: 'hours', label: 'Horas', factor: 60 },
  { value: 'days', label: 'Días', factor: 1440 },
  { value: 'weeks', label: 'Semanas', factor: 10080 },
];

/* Convert total minutes to a human label */
const formatDelay = (minutes) => {
  if (!minutes || minutes === 0) return 'Inmediato';
  if (minutes >= 10080 && minutes % 10080 === 0) return `${minutes / 10080} semana${minutes / 10080 > 1 ? 's' : ''}`;
  if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440} día${minutes / 1440 > 1 ? 's' : ''}`;
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} hora${minutes / 60 > 1 ? 's' : ''}`;
  return `${minutes} min`;
};

/* Break total minutes back into value + unit */
const decomposeDelay = (totalMinutes) => {
  if (!totalMinutes || totalMinutes === 0) return { value: 0, unit: 'minutes' };
  if (totalMinutes >= 10080 && totalMinutes % 10080 === 0) return { value: totalMinutes / 10080, unit: 'weeks' };
  if (totalMinutes >= 1440 && totalMinutes % 1440 === 0) return { value: totalMinutes / 1440, unit: 'days' };
  if (totalMinutes >= 60 && totalMinutes % 60 === 0) return { value: totalMinutes / 60, unit: 'hours' };
  return { value: totalMinutes, unit: 'minutes' };
};

const EMPTY_FORM = {
  name: '',
  trigger: 'order_status_change',
  status: 'delivered',
  template_id: '',
  delay_value: 0,
  delay_unit: 'minutes',
  include_order_items: false,
  include_reorder: false,
  include_suggestions: false,
};

const AutomationList = ({ automations, templates, orderStatuses = [], loading, onSave, onToggle, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = creating, string = editing
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const automationTemplates = templates.filter(t => t.type === 'automation' || t.type === 'transactional');

  const computeDelayMinutes = () => {
    const unit = DELAY_UNITS.find(u => u.value === form.delay_unit) || DELAY_UNITS[0];
    return (form.delay_value || 0) * unit.factor;
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (auto) => {
    const delay = decomposeDelay(auto.delay_minutes || 0);
    setEditingId(auto._id);
    setForm({
      name: auto.name || '',
      trigger: auto.trigger || 'order_status_change',
      status: auto.condition?.status || 'delivered',
      template_id: auto.template_id || '',
      delay_value: delay.value,
      delay_unit: delay.unit,
      include_order_items: !!auto.include_order_items,
      include_reorder: !!auto.include_reorder,
      include_suggestions: !!auto.include_suggestions,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.template_id) return;
    await onSave(editingId, {
      name: form.name,
      trigger: form.trigger,
      condition: { status: form.status },
      template_id: form.template_id,
      delay_minutes: computeDelayMinutes(),
      include_order_items: form.include_order_items,
      include_reorder: form.include_reorder,
      include_suggestions: form.include_suggestions,
    });
    closeForm();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-matrix-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
          <FaRobot className="text-matrix-green" />
          Automaciones ({automations.length})
        </h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-matrix-green/20 hover:bg-matrix-green/30 text-matrix-green rounded-xl font-medium transition-colors text-sm border border-matrix-green/20"
        >
          <FaPlus size={12} />
          Nueva Automación
        </button>
      </div>

      {/* Create / Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="bg-light-surface dark:bg-dark-surface border border-matrix-green/20 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
                {editingId ? '✏️ Editar Automación' : '✨ Nueva Automación'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Name */}
                <div>
                  <label className="block text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Nombre</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: Review post-entrega"
                    className="w-full px-3 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 dark:border-dark-border/10 rounded-lg text-sm text-light-text-primary dark:text-dark-text-primary outline-none focus:ring-2 focus:ring-matrix-green/30"
                  />
                </div>

                {/* Status trigger */}
                <div>
                  <label className="block text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Cuando el pedido pasa a</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 dark:border-dark-border/10 rounded-lg text-sm text-light-text-primary dark:text-dark-text-primary outline-none focus:ring-2 focus:ring-matrix-green/30"
                  >
                    {orderStatuses.map(s => (
                      <option key={s.key} value={s.key}>{s.icon} {s.label}</option>
                    ))}
                  </select>
                </div>

                {/* Template */}
                <div>
                  <label className="block text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Template</label>
                  {automationTemplates.length === 0 ? (
                    <p className="text-[11px] text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg">
                      ⚠️ Crea un template de tipo "automatización" o "transaccional" primero
                    </p>
                  ) : (
                    <select
                      value={form.template_id}
                      onChange={(e) => setForm(f => ({ ...f, template_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 dark:border-dark-border/10 rounded-lg text-sm text-light-text-primary dark:text-dark-text-primary outline-none focus:ring-2 focus:ring-matrix-green/30"
                    >
                      <option value="">Seleccionar template...</option>
                      {automationTemplates.map(t => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Delay — value + unit */}
                <div>
                  <label className="block text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    <FaClock size={10} className="inline mr-1" />
                    Delay después del trigger
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      value={form.delay_value}
                      onChange={(e) => setForm(f => ({ ...f, delay_value: parseInt(e.target.value) || 0 }))}
                      className="flex-1 px-3 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 dark:border-dark-border/10 rounded-lg text-sm text-light-text-primary dark:text-dark-text-primary outline-none focus:ring-2 focus:ring-matrix-green/30"
                      placeholder="0"
                    />
                    <select
                      value={form.delay_unit}
                      onChange={(e) => setForm(f => ({ ...f, delay_unit: e.target.value }))}
                      className="w-28 px-2 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 dark:border-dark-border/10 rounded-lg text-sm text-light-text-primary dark:text-dark-text-primary outline-none focus:ring-2 focus:ring-matrix-green/30"
                    >
                      {DELAY_UNITS.map(u => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary mt-1">
                    {form.delay_value > 0
                      ? `= ${computeDelayMinutes()} minutos totales (${formatDelay(computeDelayMinutes())})`
                      : 'Se enviará inmediatamente al cambiar de estado'}
                  </p>
                </div>
              </div>

              {/* Include flags */}
              <div className="border-t border-light-border/5 dark:border-dark-border/5 pt-3">
                <p className="text-[10px] font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">📦 Contenido del email:</p>
                <div className="space-y-2">
                  {[
                    { key: 'include_order_items', label: '📋 Incluir detalle del pedido', desc: 'Tabla con productos, cantidades y precios' },
                    { key: 'include_reorder', label: '🔄 Incluir botón volver a pedir', desc: 'Link para repetir el pedido' },
                    { key: 'include_suggestions', label: '💡 Incluir productos sugeridos', desc: 'Grid con productos de la misma categoría' },
                  ].map(toggle => (
                    <button
                      key={toggle.key}
                      onClick={() => setForm(f => ({ ...f, [toggle.key]: !f[toggle.key] }))}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all text-left ${
                        form[toggle.key]
                          ? 'bg-matrix-green/10 border-matrix-green/30'
                          : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 dark:border-dark-border/10'
                      }`}
                    >
                      <span className="text-lg">{form[toggle.key] ? '✅' : '⬜'}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-bold ${form[toggle.key] ? 'text-matrix-green' : 'text-light-text-primary dark:text-dark-text-primary'}`}>{toggle.label}</p>
                        <p className="text-[9px] text-light-text-tertiary dark:text-dark-text-tertiary">{toggle.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Presets — only in create mode */}
              {!editingId && (
                <div className="border-t border-light-border/5 dark:border-dark-border/5 pt-3">
                  <p className="text-[10px] font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">⚡ Presets comunes:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'Confirmación', status: 'confirmed', delay: 0, unit: 'minutes' },
                      { label: 'Listo para retiro', status: 'ready', delay: 0, unit: 'minutes' },
                      { label: 'En camino', status: 'dispatched', delay: 0, unit: 'minutes' },
                      { label: 'Review (2h)', status: 'delivered', delay: 2, unit: 'hours' },
                      { label: 'Promo (3 días)', status: 'delivered', delay: 3, unit: 'days' },
                      { label: 'Recompra (1 sem)', status: 'delivered', delay: 1, unit: 'weeks' },
                    ].map((p) => (
                      <button
                        key={p.label}
                        onClick={() => setForm(f => ({
                          ...f,
                          name: f.name || p.label,
                          status: p.status,
                          delay_value: p.delay,
                          delay_unit: p.unit,
                        }))}
                        className="px-2.5 py-1 text-[10px] font-medium bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-matrix-green/10 border border-light-border/8 dark:border-dark-border/8 hover:border-matrix-green/30 rounded-lg transition-all text-light-text-secondary dark:text-dark-text-secondary hover:text-matrix-green"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={closeForm}
                  className="px-3 py-1.5 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.name.trim() || !form.template_id}
                  className="px-4 py-1.5 text-sm font-bold bg-matrix-green text-black rounded-lg hover:bg-matrix-green/80 disabled:opacity-50 transition-colors"
                >
                  {editingId ? 'Guardar Cambios' : 'Crear Automación'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {automations.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center h-48 text-light-text-secondary dark:text-dark-text-secondary">
          <FaRobot size={32} className="mb-3 opacity-40" />
          <p className="text-sm">No hay automaciones aún</p>
          <p className="text-[11px] mt-1">Envía emails automáticos cuando un pedido cambia de estado</p>
          <button onClick={openCreate} className="mt-3 text-matrix-green text-sm hover:underline">
            Crear tu primera automación →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {automations.map((auto, i) => {
            const statusOpt = orderStatuses.find(s => s.key === auto.condition?.status);
            const delayLabel = formatDelay(auto.delay_minutes);
            const isEditing = editingId === auto._id && showForm;
            return (
              <motion.div
                key={auto._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`bg-light-surface dark:bg-dark-surface border rounded-xl p-4 transition-all group ${
                  isEditing
                    ? 'border-matrix-green/40 ring-2 ring-matrix-green/20'
                    : 'border-light-border/10 dark:border-dark-border/10 hover:border-matrix-green/15'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Toggle */}
                    <button
                      onClick={() => onToggle(auto._id)}
                      className={`text-2xl transition-colors ${auto.active ? 'text-matrix-green' : 'text-gray-500'}`}
                    >
                      {auto.active ? <FaToggleOn /> : <FaToggleOff />}
                    </button>

                    <div>
                      <h3 className="font-bold text-sm text-light-text-primary dark:text-dark-text-primary">
                        {auto.name}
                      </h3>
                      <p className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary flex items-center gap-2 flex-wrap">
                        <span>
                          Cuando: <strong>{statusOpt?.icon} {statusOpt?.label || auto.condition?.status}</strong>
                        </span>
                        <span className={`flex items-center gap-0.5 ${auto.delay_minutes > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          <FaClock size={9} />
                          {delayLabel}
                        </span>
                        <span>→ {auto.template_name || 'template'}</span>
                      </p>
                      {/* Show flags */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {auto.include_order_items && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">📋 Items</span>
                        )}
                        {auto.include_reorder && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-medium">🔄 Reorder</span>
                        )}
                        {auto.include_suggestions && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">💡 Sugeridos</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary font-mono">
                      {auto.sent_count || 0} enviados
                    </span>

                    <button
                      onClick={() => openEdit(auto)}
                      className="p-1.5 text-light-text-secondary/50 dark:text-dark-text-secondary/50 hover:text-matrix-green hover:bg-matrix-green/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Editar"
                    >
                      <FaPen size={10} />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar "${auto.name}"?`)) onDelete(auto._id);
                      }}
                      className="p-1.5 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <FaTrash size={10} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AutomationList;
