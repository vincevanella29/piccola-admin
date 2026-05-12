// DeliveryReviews.jsx — Uber-style advanced customer reviews dashboard
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FaStar, FaChevronLeft, FaChevronRight, FaFilter, FaSync,
  FaSpinner, FaStoreAlt, FaQuoteLeft, FaCrown, FaTags, FaUtensils, FaUserTag,
} from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { fetchReviewStats, fetchReviews, fetchDeliveryLocations } from '../../utils/deliveryData';

// ── Helpers ────────────────────────────────────────────────

const fmt = (n) => n == null ? '$0' : '$' + Math.round(n).toLocaleString('es-CL');

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
};

// ── Stars Component ─────────────────────────────────────────

const Stars = ({ count = 0, size = 16 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <FaStar key={i} size={size} className={`transition-colors ${i <= count ? 'text-amber-400' : 'text-light-border/20 dark:text-dark-border/20'}`} />
    ))}
  </div>
);

// ── Star Distribution Bar ───────────────────────────────────

const StarDistribution = ({ distribution = {}, total = 0 }) => {
  const bars = [5, 4, 3, 2, 1];

  return (
    <div className="space-y-2">
      {bars.map(star => {
        const count = distribution[String(star)] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-3">
            <div className="flex items-center gap-1 w-10 justify-end">
              <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">{star}</span>
              <FaStar size={10} className="text-amber-400" />
            </div>
            <div className="flex-1 h-2.5 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, delay: 0.1 * (5 - star) }}
                className="h-full rounded-full"
                style={{
                  background: star >= 4 ? 'linear-gradient(90deg, #22c55e, #4ade80)' :
                    star === 3 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' :
                      'linear-gradient(90deg, #ef4444, #f87171)',
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-light-text-secondary dark:text-dark-text-secondary w-14 text-right">
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ── Analytics Components ─────────────────────────────────────

const TopDishesCarousel = ({ dishes = [] }) => {
  if (!dishes.length) return <p className="text-sm text-light-text-secondary">No hay platos rankeados aún.</p>;

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
      {dishes.map((dish, i) => (
        <div key={i} className="min-w-[140px] max-w-[140px] bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-xl overflow-hidden border border-light-border/10 dark:border-dark-border/10 flex-shrink-0">
          <div className="h-24 w-full bg-light-surface-tertiary dark:bg-dark-surface-tertiary flex items-center justify-center overflow-hidden">
            {dish.image_url ? (
              <img src={dish.image_url} alt={dish.name} className="w-full h-full object-cover" />
            ) : (
              <FaUtensils size={24} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
            )}
          </div>
          <div className="p-3">
            <h3 className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary line-clamp-2 leading-tight mb-2 h-8">
              {dish.name}
            </h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-amber-400/10 px-1.5 py-0.5 rounded text-amber-500 font-bold text-[10px]">
                <FaStar size={8} /> {dish.avg_stars}
              </div>
              <span className="text-[9px] text-light-text-tertiary">{dish.count} reviews</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const LoyalCustomers = ({ customers = [] }) => {
  if (!customers.length) return null;
  return (
    <div className="space-y-3">
      {customers.map((c, i) => (
        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/5 dark:border-dark-border/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-matrix-green/10 text-matrix-green flex items-center justify-center font-bold text-xs">
              {c.name[0].toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-1">
                {c.name} {i === 0 && <FaCrown className="text-amber-400" size={12} />}
              </p>
              <p className="text-[10px] text-light-text-secondary">{c.count} pedidos • Último: {fmtDate(c.last_review)}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <FaStar size={10} className="text-amber-400" />
              <span className="text-xs font-bold">{c.avg_stars}</span>
            </div>
            <p className="text-[9px] text-light-text-tertiary">Promedio</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const TagCloud = ({ tags = [] }) => {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t, i) => (
        <span key={i} className="px-3 py-1.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 rounded-full text-[10px] font-bold flex items-center gap-1.5">
          <FaTags size={8} /> {t.tag} <span className="text-[9px] opacity-70 ml-1">({t.count})</span>
        </span>
      ))}
    </div>
  );
};


// ── Review Card ─────────────────────────────────────────────

const ReviewCard = ({ review }) => {
  const rev = review.review || {};
  const orderItems = review.items || [];

  // Cross-reference order items with review items if available
  const reviewItemsMap = {};
  if (Array.isArray(rev.items)) {
    rev.items.forEach(ri => {
      if (ri.item_id) reviewItemsMap[ri.item_id] = ri;
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-xl p-4 hover:shadow-lg transition-shadow"
    >
      {/* Top: stars + date */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Stars count={rev.overall_stars || 0} size={14} />
          <span className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
            {rev.overall_stars || 0}/5
          </span>
        </div>
        <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">
          {fmtDate(rev.received_at || review.delivered_at)} {fmtTime(rev.received_at || review.delivered_at)}
        </span>
      </div>

      {/* Tags */}
      {Array.isArray(rev.overall_tags) && rev.overall_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {rev.overall_tags.map((tag, i) => (
            <span key={i} className="px-2 py-0.5 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded text-[9px] font-medium text-light-text-secondary">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Comment */}
      {rev.comment && (
        <div className="mb-4 pl-3 border-l-2 border-amber-400/30">
          <FaQuoteLeft size={8} className="text-amber-400/40 mb-1" />
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic leading-relaxed">
            {rev.comment}
          </p>
        </div>
      )}

      {/* Item-level ratings */}
      {orderItems.length > 0 && (
        <div className="mb-4 space-y-1.5 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 p-2.5 rounded-lg">
          <p className="text-[10px] font-bold text-light-text-tertiary mb-1.5">Platos Evaluados:</p>
          {orderItems.map((item, idx) => {
            const ri = reviewItemsMap[item.codigo];
            return (
              <div key={idx} className="flex items-center justify-between text-[11px]">
                <span className="text-light-text-secondary line-clamp-1 flex-1 pr-2">{item.nombre}</span>
                {ri && ri.stars ? (
                  <div className="flex items-center gap-1 w-16 justify-end">
                    <FaStar size={8} className="text-amber-400" />
                    <span className="font-bold text-light-text-primary">{ri.stars}</span>
                  </div>
                ) : (
                  <span className="text-[9px] text-light-text-tertiary italic w-16 text-right">No evaluado</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Customer + order info */}
      <div className="flex items-center justify-between pt-3 border-t border-light-border/5 dark:border-dark-border/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-matrix-green/10 rounded-full flex items-center justify-center text-matrix-green text-[10px] font-bold">
            {(review.customer?.name || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-semibold text-light-text-primary dark:text-dark-text-primary">
              {review.customer?.name || 'Cliente'}
            </p>
            <p className="text-[9px] text-light-text-tertiary">
              #{(review.order_number || review._id || '').slice(-8).toUpperCase()} · {fmt(review.total_amount)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-light-text-tertiary">{review.location_name || '—'}</p>
        </div>
      </div>
    </motion.div>
  );
};

// ── Main Component ──────────────────────────────────────────

const DeliveryReviews = ({ appState }) => {
  const [activeTab, setActiveTab] = useState('analytics'); // analytics | list
  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // List filters
  const [page, setPage] = useState(0);
  const [starFilter, setStarFilter] = useState(null);
  const [locFilter, setLocFilter] = useState('');
  const PAGE_SIZE = 15;

  const auth = useMemo(() => ({
    token: appState?.token,
    walletAddress: appState?.account,
  }), [appState?.token, appState?.account]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchReviewStats(auth);
      setStats(res?.stats || null);
    } catch (e) {
      console.error("Error loading stats:", e);
    }
  }, [auth]);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchReviews({
        ...auth,
        stars: starFilter || undefined,
        locationId: locFilter || undefined,
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setReviews(res?.reviews || []);
      setTotalReviews(res?.total || 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [auth, starFilter, locFilter, page]);

  const loadLocations = useCallback(async () => {
    try {
      const res = await fetchDeliveryLocations(auth);
      setLocations(res?.locations || []);
    } catch (e) {
      console.error("Error loading stats:", e);
    }
  }, [auth]);

  useEffect(() => { loadStats(); loadLocations(); }, [loadStats, loadLocations]);
  useEffect(() => { loadReviews(); }, [loadReviews]);

  const totalPages = Math.max(1, Math.ceil(totalReviews / PAGE_SIZE));

  return (
    <div className="w-full max-w-[1200px] mx-auto p-4 sm:p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-futurist font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-3">
            <FaStar className="text-amber-400" /> Review Analytics
          </h1>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
            Métricas avanzadas y satisfacción de clientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-light-surface-secondary dark:bg-dark-surface-secondary p-1 rounded-xl border border-light-border/10 dark:border-dark-border/10">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'analytics' ? 'bg-light-surface dark:bg-dark-surface shadow-sm text-matrix-green' : 'text-light-text-tertiary'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'list' ? 'bg-light-surface dark:bg-dark-surface shadow-sm text-matrix-green' : 'text-light-text-tertiary'}`}
            >
              Feed de Reseñas
            </button>
          </div>
          <button onClick={() => { loadStats(); loadReviews(); }}
            className="w-9 h-9 flex items-center justify-center bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-xl hover:bg-light-surface-tertiary transition-colors border border-light-border/10 dark:border-dark-border/10">
            <FaSync size={12} className={loading ? 'animate-spin text-matrix-green' : 'text-light-text-secondary'} />
          </button>
        </div>
      </div>

      {activeTab === 'analytics' && stats && (
        <div className="space-y-6">
          {/* Top Hero Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Global Rating Card */}
            <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/15 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.4 }}
                className="text-6xl font-black text-amber-400 font-mono mb-2"
              >
                {stats.avg_stars.toFixed(1)}
              </motion.div>
              <Stars count={Math.round(stats.avg_stars)} size={20} />
              <p className="text-xs font-bold text-light-text-secondary mt-3">Promedio General</p>
              <p className="text-[10px] text-light-text-tertiary mt-1">Basado en {stats.count} reseñas totales</p>
            </div>

            {/* Distribution Card */}
            <div className="bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-2xl p-6 flex flex-col justify-center">
              <h3 className="text-xs font-bold text-light-text-secondary uppercase mb-4 tracking-wider flex items-center gap-2">
                <FaFilter size={10} /> Distribución de Estrellas
              </h3>
              <StarDistribution distribution={stats.distribution} total={stats.count} />
            </div>

            {/* Tags Cloud Card */}
            <div className="bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-2xl p-6">
              <h3 className="text-xs font-bold text-light-text-secondary uppercase mb-4 tracking-wider flex items-center gap-2">
                <FaTags size={10} /> Temas Recurrentes
              </h3>
              <TagCloud tags={stats.tags} />
            </div>

          </div>

          {/* Bottom Insights Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Top Dishes */}
            <div className="bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-light-text-secondary uppercase tracking-wider flex items-center gap-2">
                  <FaUtensils size={10} /> Platos Mejor Evaluados
                </h3>
                <span className="text-[10px] bg-matrix-green/10 text-matrix-green px-2 py-0.5 rounded font-bold">Top 10</span>
              </div>
              <TopDishesCarousel dishes={stats.top_items} />
            </div>

            {/* Loyal Customers */}
            <div className="bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-light-text-secondary uppercase tracking-wider flex items-center gap-2">
                  <FaUserTag size={10} /> Clientes Más Leales
                </h3>
                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-bold">Por frecuencia</span>
              </div>
              <LoyalCustomers customers={stats.top_customers} />
            </div>

          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* List Filters */}
          <div className="flex flex-col sm:flex-row gap-3 bg-light-surface dark:bg-dark-surface p-4 rounded-xl border border-light-border/10 dark:border-dark-border/10">
            <div className="flex items-center gap-2 flex-1">
              <FaFilter className="text-light-text-tertiary" size={12} />
              <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
                {[null, 5, 4, 3, 2, 1].map(s => (
                  <button
                    key={s || 'all'}
                    onClick={() => { setStarFilter(s); setPage(0); }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg whitespace-nowrap border ${starFilter === s ? 'bg-amber-400/10 border-amber-400/30 text-amber-500' : 'bg-transparent border-light-border/10 dark:border-dark-border/10 text-light-text-secondary hover:bg-light-surface-secondary'}`}
                  >
                    {s ? <span className="flex items-center gap-1">{s} <FaStar size={10} /></span> : 'Todas'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <FaStoreAlt className="text-light-text-tertiary" size={12} />
              <select
                value={locFilter}
                onChange={e => { setLocFilter(e.target.value); setPage(0); }}
                className="w-full sm:w-48 bg-light-surface-secondary dark:bg-dark-surface-secondary border-none text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-matrix-green text-light-text-primary dark:text-dark-text-primary"
              >
                <option value="">Todas las sucursales</option>
                {locations.map(l => (
                  <option key={l._id || l.slug || l.permalink_slug} value={l.slug || l.permalink_slug}>
                    {l.nombre || l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-light-text-tertiary gap-3">
              <FaSpinner className="animate-spin text-2xl" />
              <p className="text-xs">Cargando reseñas...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-20 bg-light-surface dark:bg-dark-surface rounded-xl border border-light-border/10 dark:border-dark-border/10">
              <p className="text-sm text-light-text-secondary">No se encontraron reseñas con los filtros actuales.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {reviews.map(r => (
                  <ReviewCard key={r._id} review={r} />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex justify-between items-center bg-light-surface dark:bg-dark-surface p-3 rounded-xl border border-light-border/10 dark:border-dark-border/10">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="p-2 rounded-lg hover:bg-light-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed">
                <FaChevronLeft size={12} />
              </button>
              <span className="text-xs font-mono text-light-text-secondary">Página {page + 1} de {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="p-2 rounded-lg hover:bg-light-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed">
                <FaChevronRight size={12} />
              </button>
            </div>
          )}
        </div>
      )}
      <ToastContainer position="bottom-right" theme="dark" />
    </div>
  );
};

export default DeliveryReviews;

export const pageMetadata = {
  path: '/app/delivery/reviews',
  label: 'delivery.reviews_label',
  category: 'delivery.category',
  minRoleLevel: 3,
  maxRoleLevel: 6,
  order: 5,
  locations: ['sidebar'],
  description: 'delivery.reviews_description',
  icon: 'FaStar',
  isSearchable: true,
};
