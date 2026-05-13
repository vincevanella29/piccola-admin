// src/pages/delivery/orders/OrderHistory.jsx
// Paginated order history table with search, date and status filters
import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaSearch, FaCalendarAlt, FaChevronLeft, FaChevronRight,
  FaUser, FaMotorcycle, FaBoxOpen, FaFilter, FaTimes,
  FaEye, FaStar,
} from 'react-icons/fa';

const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────

function formatCurrency(amount) {
  if (amount == null) return '$0';
  return '$' + Math.round(amount).toLocaleString('es-CL');
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function elapsedLabel(created, delivered) {
  if (!created || !delivered) return '—';
  const ms = new Date(delivered) - new Date(created);
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

// ─── Status Badge ──────────────────────────────────────────

const StatusBadge = ({ status, statusesMap }) => {
  const meta = statusesMap[status] || {};
  const color = meta.color || '#6b7280';
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: `${color}18`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {meta.label || status}
    </span>
  );
};

// ─── Main Component ──────────────────────────────────────

const OrderHistory = ({ orders = [], statuses = [], pickupStatuses = [], onSelectOrder, onStatusChange, canEdit, isLoading, t }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const statusesMap = useMemo(() => {
    const m = {};
    statuses.forEach(s => { m[s.key] = s; });
    return m;
  }, [statuses]);

  // Filter orders
  const filtered = useMemo(() => {
    let result = [...orders];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        (o.customer?.name || '').toLowerCase().includes(q) ||
        (o.order_number || '').toLowerCase().includes(q) ||
        (o._id || '').toLowerCase().includes(q) ||
        (o.customer?.phone || '').includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }

    // Date filters
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter(o => o.created_at && new Date(o.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      result = result.filter(o => o.created_at && new Date(o.created_at) <= to);
    }

    return result;
  }, [orders, search, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageOrders = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  const handleFilterChange = useCallback((setter) => (val) => {
    setter(val);
    setPage(0);
  }, []);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  };

  const hasFilters = search || statusFilter !== 'all' || dateFrom || dateTo;

  return (
    <div className="flex flex-col h-full">
      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-tertiary dark:text-dark-text-tertiary" size={12} />
          <input
            type="text"
            value={search}
            onChange={(e) => handleFilterChange(setSearch)(e.target.value)}
            placeholder={t?.('delivery.history_search') || 'Buscar por cliente, teléfono o # de orden...'}
            className="w-full pl-9 pr-4 py-2.5 bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-xl text-sm text-light-text-primary dark:text-dark-text-primary placeholder-light-text-tertiary dark:placeholder-dark-text-tertiary focus:outline-none focus:border-matrix-green/30 transition-colors"
          />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${showFilters || hasFilters
              ? 'bg-matrix-green/10 text-matrix-green border-matrix-green/20'
              : 'bg-light-surface dark:bg-dark-surface text-light-text-secondary dark:text-dark-text-secondary border-light-border/10 dark:border-dark-border/10 hover:border-light-border/20 dark:hover:border-dark-border/20'
            }`}
        >
          <FaFilter size={11} />
          {t?.('delivery.history_filters') || 'Filtros'}
          {hasFilters && (
            <span className="w-2 h-2 rounded-full bg-matrix-green" />
          )}
        </button>

        {/* Clear Filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <FaTimes size={10} />
            Limpiar
          </button>
        )}
      </div>

      {/* Expanded Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-3 mb-4 p-4 bg-light-surface/50 dark:bg-dark-surface/50 rounded-xl border border-light-border/5 dark:border-dark-border/5">
              {/* Status Filter */}
              <div className="flex-1 min-w-[150px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1 block">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => handleFilterChange(setStatusFilter)(e.target.value)}
                  className="w-full px-3 py-2 bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-lg text-xs text-light-text-primary dark:text-dark-text-primary"
                >
                  <option value="all">Todos</option>
                  {statuses.map(s => (
                    <option key={s.key} value={s.key}>{s.icon} {s.label}</option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div className="flex-1 min-w-[150px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1 block">
                  {t?.('delivery.history_date_from') || 'Desde'}
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => handleFilterChange(setDateFrom)(e.target.value)}
                  className="w-full px-3 py-2 bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-lg text-xs text-light-text-primary dark:text-dark-text-primary"
                />
              </div>

              {/* Date To */}
              <div className="flex-1 min-w-[150px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1 block">
                  {t?.('delivery.history_date_to') || 'Hasta'}
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => handleFilterChange(setDateTo)(e.target.value)}
                  className="w-full px-3 py-2 bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-lg text-xs text-light-text-primary dark:text-dark-text-primary"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
          {t?.('delivery.history_showing') || 'Mostrando'}{' '}
          <span className="font-bold text-light-text-primary dark:text-dark-text-primary">
            {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}
          </span>
          {' '}{t?.('delivery.history_of') || 'de'}{' '}
          <span className="font-bold text-light-text-primary dark:text-dark-text-primary">{filtered.length}</span>
        </p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-light-border/10 dark:border-dark-border/10 bg-light-surface/50 dark:bg-dark-surface/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border-b border-light-border/10 dark:border-dark-border/10">
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">#</th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Cliente</th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary hidden md:table-cell">Sucursal</th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Status</th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary hidden lg:table-cell">Carrier</th>
              <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Total</th>
              <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary hidden sm:table-cell">Fecha</th>
              <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary w-12"></th>
            </tr>
          </thead>
          <tbody>
            {pageOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <FaBoxOpen className="mx-auto text-light-text-tertiary dark:text-dark-text-tertiary mb-3" size={32} />
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    {t?.('delivery.history_no_results') || 'Sin resultados'}
                  </p>
                </td>
              </tr>
            ) : (
              pageOrders.map((order) => {
                const itemCount = (order.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
                return (
                  <tr
                    key={order._id}
                    onClick={() => onSelectOrder?.(order._id)}
                    className="border-b border-light-border/5 dark:border-dark-border/5 hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/30 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-bold text-light-text-primary dark:text-dark-text-primary">
                        {(order.order_number || order._id || '').slice(-8).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-semibold text-light-text-primary dark:text-dark-text-primary truncate max-w-[160px]">
                          {order.customer?.name || '—'}
                        </div>
                        {order.review && (
                          <span className="flex items-center gap-0.5 text-[9px] text-amber-400 font-bold">
                            <FaStar size={7} /> {order.review.overall_stars}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">
                        {itemCount} items
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary capitalize">
                        {order.location_name || order.location_slug || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => { if (canEdit) e.stopPropagation(); }}>
                      {canEdit ? (
                        <select
                          value={order.status}
                          onChange={(e) => onStatusChange && onStatusChange(order._id, e.target.value)}
                          className="text-[10px] font-semibold px-2 py-1 rounded-md border-none outline-none cursor-pointer"
                          style={{
                            backgroundColor: `${statusesMap[order.status]?.color || '#6b7280'}18`,
                            color: statusesMap[order.status]?.color || '#6b7280'
                          }}
                        >
                          {(order.order_type === 'pickup' ? pickupStatuses : statuses).map(s => (
                            <option key={s.key} value={s.key} className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary">
                              {s.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge status={order.status} statusesMap={statusesMap} />
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {order.carrier_slug ? (
                        <div className="flex items-center gap-1.5">
                          <FaMotorcycle size={10} className="text-cyan-400" />
                          <span className="text-xs text-cyan-400 font-medium capitalize">{order.carrier_slug}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">
                        {formatCurrency(order.total_amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{formatDate(order.created_at)}</div>
                      <div className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">{formatTime(order.created_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <FaEye
                        size={12}
                        className="text-light-text-tertiary dark:text-dark-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 text-light-text-secondary dark:text-dark-text-secondary hover:border-matrix-green/30"
          >
            <FaChevronLeft size={10} />
          </button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i;
            } else if (page < 3) {
              pageNum = i;
            } else if (page > totalPages - 4) {
              pageNum = totalPages - 5 + i;
            } else {
              pageNum = page - 2 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${page === pageNum
                    ? 'bg-matrix-green/20 text-matrix-green border border-matrix-green/30'
                    : 'bg-light-surface dark:bg-dark-surface text-light-text-secondary dark:text-dark-text-secondary border border-light-border/10 dark:border-dark-border/10 hover:border-light-border/20 dark:hover:border-dark-border/20'
                  }`}
              >
                {pageNum + 1}
              </button>
            );
          })}

          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 text-light-text-secondary dark:text-dark-text-secondary hover:border-matrix-green/30"
          >
            <FaChevronRight size={10} />
          </button>
        </div>
      )}

    </div>
  );
};

export default OrderHistory;
