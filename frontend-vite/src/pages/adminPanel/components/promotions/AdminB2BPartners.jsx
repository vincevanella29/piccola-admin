import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, CheckCircle2, XCircle, KeyRound, PlusCircle,
  ChevronDown, ChevronUp, Package, Percent, ToggleLeft, ToggleRight
} from 'lucide-react';
import api from '../../../../utils/api';

const authHeaders = ({ token, walletAddress }) => ({
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
});

const INPUT_CLASS = "w-full px-4 py-3 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/50 dark:border-dark-border/50 focus:ring-2 focus:ring-matrix-green outline-none text-light-text-primary dark:text-dark-text-primary text-sm";
const LABEL_CLASS = "block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1";

const AdminB2BPartners = ({ appState }) => {
  const { t } = useTranslation();
  const appRef = useRef(appState);
  appRef.current = appState;

  const getAuth = useCallback(() => ({
    token: appRef.current?.token,
    walletAddress: appRef.current?.account,
  }), []);

  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPartner, setExpandedPartner] = useState(null);
  const [partnerPromos, setPartnerPromos] = useState({});

  // Create modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', reward_type: 'discount',
    discount: 20, discount_type: 'percentage', product_name: '',
    total_quota: 100, max_per_user: 1, max_per_day: 5,
  });

  const fetchPartners = useCallback(async () => {
    try {
      setLoading(true);
      const auth = getAuth();
      const res = await api({ method: 'GET', endpoint: '/admin/b2b/partners', headers: authHeaders(auth), withCredentials: true });
      setPartners(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error('AdminB2BPartners.fetchPartners:', e);
    } finally {
      setLoading(false);
    }
  }, [getAuth]);

  const fetchPartnerPromos = useCallback(async (partnerId) => {
    try {
      const auth = getAuth();
      const res = await api({ method: 'GET', endpoint: `/admin/b2b/partners/${partnerId}/promotions`, headers: authHeaders(auth), withCredentials: true });
      setPartnerPromos(prev => ({ ...prev, [partnerId]: Array.isArray(res) ? res : [] }));
    } catch (e) {
      console.error('fetchPartnerPromos:', e);
    }
  }, [getAuth]);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  const handleStatusUpdate = async (id, status) => {
    try {
      const auth = getAuth();
      await api({ method: 'PUT', endpoint: `/admin/b2b/partners/${id}/status`, data: { status }, headers: authHeaders(auth), withCredentials: true });
      fetchPartners();
    } catch (e) {
      console.error('Error updating status', e);
    }
  };

  const handleToggleExpand = (partnerId) => {
    if (expandedPartner === partnerId) {
      setExpandedPartner(null);
    } else {
      setExpandedPartner(partnerId);
      if (!partnerPromos[partnerId]) fetchPartnerPromos(partnerId);
    }
  };

  const openCreateModal = (partner) => {
    setSelectedPartner(partner);
    setForm({ name: '', description: '', reward_type: 'discount', discount: 20, discount_type: 'percentage', product_name: '', total_quota: 100, max_per_user: 1, max_per_day: 5 });
    setIsModalOpen(true);
  };

  const handleCreatePromotion = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const reward_details = form.reward_type === 'discount'
      ? { discount: parseFloat(form.discount), type: form.discount_type }
      : { product_name: form.product_name };

    try {
      const auth = getAuth();
      await api({
        method: 'POST',
        endpoint: `/admin/b2b/partners/${selectedPartner._id}/promotions`,
        data: {
          name: form.name,
          description: form.description,
          reward_type: form.reward_type,
          reward_details,
          total_quota: parseInt(form.total_quota),
          max_per_user: parseInt(form.max_per_user),
          max_per_day: parseInt(form.max_per_day),
        },
        headers: authHeaders(auth),
        withCredentials: true,
      });
      setIsModalOpen(false);
      fetchPartners();
      fetchPartnerPromos(selectedPartner._id);
    } catch (e) {
      alert(e.message || t('b2b.error_allocate'));
    }
  };

  const handleTogglePromo = async (allocId) => {
    try {
      const auth = getAuth();
      await api({ method: 'PUT', endpoint: `/admin/b2b/allocations/${allocId}/toggle`, headers: authHeaders(auth), withCredentials: true });
      if (expandedPartner) fetchPartnerPromos(expandedPartner);
    } catch (e) {
      console.error('toggle error', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-light-surface dark:bg-dark-surface p-6 rounded-3xl border border-light-border/30 dark:border-dark-border/30 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-3">
            <Building2 className="text-matrix-green" />
            {t('b2b.admin_title')}
          </h2>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{t('b2b.admin_desc')}</p>
        </div>
      </div>

      {/* Partners Table */}
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border/30 dark:border-dark-border/30 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border-b border-light-border/30 dark:border-dark-border/30">
                <th className="p-4 font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('b2b.table_company')}</th>
                <th className="p-4 font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('b2b.table_contact')}</th>
                <th className="p-4 font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('b2b.table_status')}</th>
                <th className="p-4 font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('b2b.table_dilithium')}</th>
                <th className="p-4 font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('b2b.table_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {partners.map(p => (
                <React.Fragment key={p._id}>
                  <tr className="border-b border-light-border/20 dark:border-dark-border/20 hover:bg-light-surface-secondary/20 dark:hover:bg-dark-surface-secondary/20 transition-colors">
                    <td className="p-4">
                      <p className="font-semibold text-light-text-primary dark:text-dark-text-primary">{p.company_name}</p>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        Owner: {p.wallet_owner?.substring(0,8)}...
                        {p.active_promotions > 0 && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-matrix-green/10 text-matrix-green font-bold">
                            {p.active_promotions} {t('b2b.active_promos')}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-light-text-primary dark:text-dark-text-primary">{p.contact_email}</p>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{p.contact_phone || 'N/A'}</p>
                    </td>
                    <td className="p-4">
                      {p.status === 'pending' ? (
                        <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-600 text-xs font-semibold">{t('b2b.status_pending')}</span>
                      ) : p.status === 'approved' ? (
                        <span className="px-3 py-1 rounded-full bg-matrix-green/10 text-matrix-green text-xs font-semibold">{t('b2b.status_approved')}</span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-light-error/10 text-light-error text-xs font-semibold">{t('b2b.status_rejected')}</span>
                      )}
                    </td>
                    <td className="p-4">
                      {p.dilithium_public_key ? (
                        <span className="flex items-center gap-1 text-matrix-green text-xs font-medium"><KeyRound size={14} /> {t('b2b.configured')}</span>
                      ) : (
                        <span className="text-light-text-secondary dark:text-dark-text-secondary text-xs">{t('b2b.not_configured')}</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 items-center">
                        {p.status === 'pending' && (
                          <>
                            <button onClick={() => handleStatusUpdate(p._id, 'approved')} className="p-2 text-matrix-green hover:bg-matrix-green/10 rounded-lg transition-colors" title={t('b2b.action_approve')}><CheckCircle2 size={18} /></button>
                            <button onClick={() => handleStatusUpdate(p._id, 'rejected')} className="p-2 text-light-error hover:bg-light-error/10 rounded-lg transition-colors" title={t('b2b.action_reject')}><XCircle size={18} /></button>
                          </>
                        )}
                        {p.status === 'approved' && (
                          <>
                            <button onClick={() => openCreateModal(p)} className="px-3 py-1.5 text-xs font-medium bg-matrix-green text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5">
                              <PlusCircle size={14} /> {t('b2b.create_promotion')}
                            </button>
                            <button onClick={() => handleToggleExpand(p._id)} className="p-2 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50 rounded-lg transition-colors">
                              {expandedPartner === p._id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded promotions row */}
                  {expandedPartner === p._id && (
                    <tr>
                      <td colSpan="5" className="p-0">
                        <div className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 p-4 border-b border-light-border/20 dark:border-dark-border/20">
                          <h4 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary mb-3">{t('b2b.partner_promotions')}</h4>
                          {(!partnerPromos[p._id] || partnerPromos[p._id].length === 0) ? (
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{t('b2b.no_promotions')}</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {partnerPromos[p._id].map(promo => (
                                <div key={promo._id} className="p-4 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border/30 dark:border-dark-border/30">
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <h5 className="font-semibold text-sm text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                                        {promo.reward_type === 'discount' ? <Percent size={14} className="text-matrix-green" /> : <Package size={14} className="text-vanellix-purple" />}
                                        {promo.promotion_name}
                                      </h5>
                                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                        {promo.reward_type === 'discount'
                                          ? `${promo.reward_details?.discount}${promo.reward_details?.type === 'percentage' ? '%' : ' CLP'} OFF`
                                          : promo.reward_details?.product_name
                                        }
                                      </p>
                                    </div>
                                    <button onClick={() => handleTogglePromo(promo._id)} className="p-1" title={promo.active ? 'Deactivate' : 'Activate'}>
                                      {promo.active
                                        ? <ToggleRight size={22} className="text-matrix-green" />
                                        : <ToggleLeft size={22} className="text-light-text-secondary dark:text-dark-text-secondary" />
                                      }
                                    </button>
                                  </div>
                                  {/* Progress bar */}
                                  <div className="w-full bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-full h-1.5 my-2">
                                    <div className="bg-matrix-green h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, ((promo.claimed_count || 0) / promo.total_quota) * 100)}%` }} />
                                  </div>
                                  <div className="flex justify-between text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                                    <span>{promo.claimed_count || 0}/{promo.total_quota} {t('b2b.used')}</span>
                                    <span>{t('b2b.max_per_user')}: {promo.max_per_user} · {t('b2b.max_per_day')}: {promo.max_per_day}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {partners.length === 0 && !loading && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-light-text-secondary dark:text-dark-text-secondary">{t('b2b.no_partners')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create B2B Promotion Modal ── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-light-surface dark:bg-dark-surface rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-light-border/50 dark:border-dark-border/50"
            >
              <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary mb-1">{t('b2b.create_promotion_title')}</h3>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-6">
                {t('b2b.create_promotion_for')} <strong>{selectedPartner?.company_name}</strong>
              </p>

              <form onSubmit={handleCreatePromotion} className="space-y-4">
                {/* Name */}
                <div>
                  <label className={LABEL_CLASS}>{t('b2b.promo_name')}</label>
                  <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={INPUT_CLASS} placeholder="Ej: Descuento 20% para empleados..." />
                </div>

                {/* Description */}
                <div>
                  <label className={LABEL_CLASS}>{t('b2b.promo_description')}</label>
                  <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className={INPUT_CLASS} />
                </div>

                {/* Reward Type Toggle */}
                <div>
                  <label className={LABEL_CLASS}>{t('b2b.promo_type')}</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setForm({...form, reward_type: 'discount'})}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border transition-all ${
                        form.reward_type === 'discount'
                          ? 'bg-matrix-green/10 text-matrix-green border-matrix-green/30'
                          : 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-light-text-secondary dark:text-dark-text-secondary border-light-border/30 dark:border-dark-border/30'
                      }`}
                    >
                      <Percent size={16} /> {t('b2b.type_discount')}
                    </button>
                    <button type="button" onClick={() => setForm({...form, reward_type: 'product'})}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border transition-all ${
                        form.reward_type === 'product'
                          ? 'bg-vanellix-purple/10 text-vanellix-purple border-vanellix-purple/30'
                          : 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-light-text-secondary dark:text-dark-text-secondary border-light-border/30 dark:border-dark-border/30'
                      }`}
                    >
                      <Package size={16} /> {t('b2b.type_product')}
                    </button>
                  </div>
                </div>

                {/* Conditional fields */}
                {form.reward_type === 'discount' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLASS}>{t('b2b.discount_amount')}</label>
                      <input required type="number" min="1" value={form.discount} onChange={e => setForm({...form, discount: e.target.value})} className={INPUT_CLASS} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>{t('b2b.discount_type')}</label>
                      <select value={form.discount_type} onChange={e => setForm({...form, discount_type: e.target.value})} className={INPUT_CLASS}>
                        <option value="percentage">% {t('b2b.percentage')}</option>
                        <option value="fixed">$ {t('b2b.fixed')}</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className={LABEL_CLASS}>{t('b2b.product_name')}</label>
                    <input required type="text" value={form.product_name} onChange={e => setForm({...form, product_name: e.target.value})} className={INPUT_CLASS} placeholder="Ej: Pizza Margherita" />
                  </div>
                )}

                {/* Limits */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={LABEL_CLASS}>{t('b2b.total_quota')}</label>
                    <input required type="number" min="1" value={form.total_quota} onChange={e => setForm({...form, total_quota: e.target.value})} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>{t('b2b.max_per_user')}</label>
                    <input required type="number" min="1" value={form.max_per_user} onChange={e => setForm({...form, max_per_user: e.target.value})} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>{t('b2b.max_per_day')}</label>
                    <input required type="number" min="1" value={form.max_per_day} onChange={e => setForm({...form, max_per_day: e.target.value})} className={INPUT_CLASS} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-light-text-primary dark:text-dark-text-primary rounded-xl font-medium hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors">
                    {t('b2b.cancel')}
                  </button>
                  <button type="submit" className="flex-1 py-3 bg-matrix-green text-white rounded-xl font-medium hover:opacity-90 transition-opacity">
                    {t('b2b.create_btn')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminB2BPartners;
