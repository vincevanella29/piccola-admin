import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCcw, CheckCircle2, XCircle, PlayCircle, Info, ChevronDown, Code, FileCode, Copy, LoaderCircle, Landmark } from 'lucide-react';

import useDaoMeritocracy from '../../../../hooks/useDaoMeritocracy.jsx';

// --- Componente: Tarjeta de Propuesta Individual ---
const ProposalCard = ({ proposal, isExpanded, onToggle, onVote, onExecute, appState }) => {
  const { t } = useTranslation();
  const [isDecoded, setIsDecoded] = useState(true);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text || '');
      toast.success(t('common.copied') || 'Copiado al portapapeles');
    } catch (e) {
      toast.error(e?.message || 'No se pudo copiar');
    }
  };

  const statusInfo = proposal.executed
    ? { text: t('dao.executed') || 'Ejecutada', badgeClass: 'bg-matrix-green/10 text-matrix-green border-matrix-green/20' }
    : { text: t('dao.pending') || 'Pendiente', badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };

  return (
    <div className={`overflow-hidden transition-all duration-300 ease-in-out border rounded-[24px] shadow-sm ${isExpanded ? 'bg-white/90 dark:bg-dark-surface-secondary/60 border-dark-border/20 dark:border-dark-border/40 my-4' : 'bg-white/60 dark:bg-dark-surface/40 hover:bg-white/80 dark:hover:bg-dark-surface-secondary/40 border-dark-border/10 dark:border-dark-border/20'} backdrop-blur-md`}>
      {/* Encabezado visible de la tarjeta */}
      <header
        className="flex items-center justify-between p-5 cursor-pointer select-none group"
        onClick={onToggle}
      >
        <div className="flex items-center gap-5">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black tracking-widest uppercase border ${statusInfo.badgeClass}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${proposal.executed ? 'bg-matrix-green' : 'bg-amber-500 animate-pulse'}`} />
            <span>{statusInfo.text}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-light-text-primary dark:text-dark-text-primary tracking-tight transition-colors group-hover:text-black dark:group-hover:text-white">
              {proposal.decoded?.function || t('dao.unknown_function') || 'Función Desconocida'}
            </span>
            <span className="text-xs font-mono text-light-text-secondary dark:text-dark-text-secondary mt-0.5 opacity-80">
              Proposal ID: {proposal.id}
            </span>
          </div>
        </div>
        <div className={`p-1.5 rounded-full transition-all duration-300 ${isExpanded ? 'bg-gray-200 dark:bg-gray-700' : 'bg-transparent group-hover:bg-gray-200 dark:group-hover:bg-gray-700'}`}>
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
            <ChevronDown size={20} className="text-light-text-secondary dark:text-dark-text-secondary" />
          </motion.div>
        </div>
      </header>

      {/* Contenido expandible con animación */}
      <AnimatePresence>
        {isExpanded && (
          <motion.section
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-hidden"
          >
            <div className="p-6 pt-2 border-t border-dark-border/10">
              {/* Detalles de la propuesta */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <DetailItem label={t('dao.target') || 'Contrato Destino'} value={proposal.target} onCopy={copyToClipboard} isMono />
                <DetailItem label={t('dao.tx_hash') || 'Tx Hash (Creación)'} value={proposal.transactionHash} onCopy={copyToClipboard} isMono isLink={`${appState?.blockExplorer}/tx/0x${proposal.transactionHash}`} />
                <DetailItem label={t('dao.block') || 'Bloque'} value={proposal.blockNumber} isMono />
              </div>

              {/* Sección de CallData */}
              <div className="bg-gray-50/80 dark:bg-dark-surface rounded-2xl border border-dark-border/5 dark:border-dark-border/20 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-dark-border/5 dark:border-dark-border/20 bg-gray-100/50 dark:bg-dark-surface-secondary/40">
                  <h4 className="font-bold text-[13px] uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                    {t('dao.call_data') || 'Payload del CallData'}
                  </h4>
                  <div className="flex items-center gap-3">
                    <button onClick={() => copyToClipboard(proposal.callData)} className="p-1.5 rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:bg-white dark:hover:bg-dark-surface hover:text-black dark:hover:text-white transition-all border border-transparent hover:border-dark-border/10 dark:hover:border-dark-border/30 shadow-sm" title={t('dao.copy_raw') || 'Copiar Raw Data'}>
                      <Copy size={16} />
                    </button>
                    <div className="bg-gray-200/60 dark:bg-black/30 p-1 rounded-xl flex shadow-inner">
                      <button onClick={() => setIsDecoded(true)} className={`px-3 py-1.5 text-[11px] font-black tracking-wide uppercase rounded-lg flex items-center gap-1.5 transition-all ${isDecoded ? 'bg-white dark:bg-dark-surface-secondary text-black dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}><FileCode size={12} /> {t('dao.decoded') || 'Decoded'}</button>
                      <button onClick={() => setIsDecoded(false)} className={`px-3 py-1.5 text-[11px] font-black tracking-wide uppercase rounded-lg flex items-center gap-1.5 transition-all ${!isDecoded ? 'bg-white dark:bg-dark-surface-secondary text-black dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}><Code size={12} /> {t('dao.raw') || 'Raw'}</button>
                    </div>
                  </div>
                </div>
                <div className="p-5 text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed bg-white/40 dark:bg-transparent">
                  {isDecoded ? (
                    proposal.decoded ? (
                      <>
                        <div className="text-matrix-green font-bold">
                          <span className="text-pink-500 opacity-90">{t('dao.function') || 'function'} </span>
                          {proposal.decoded.function}
                          <span className="opacity-90">()</span>
                        </div>
                        <div className="mt-3 pl-4 border-l-2 border-dark-border/10 dark:border-dark-border/20 py-1">
                          <span className="text-indigo-500 opacity-90 font-bold">{t('dao.args') || 'args'}:</span>
                          <pre className="mt-2 text-light-text-primary dark:text-gray-300 bg-gray-50 dark:bg-dark-surface-secondary/20 p-3 rounded-xl border border-dark-border/5">
                            {JSON.stringify(proposal.decoded.args, null, 2)}
                          </pre>
                        </div>
                      </>
                    ) : (
                      <span className="text-light-text-secondary dark:text-dark-text-secondary italic">{t('dao.no_decoded_data') || 'Datos no decodificados disponibles.'}</span>
                    )
                  ) : (
                    <span className="text-gray-500">{proposal.callData || '-'}</span>
                  )}
                </div>
              </div>

              {/* Botones de acción */}
              <footer className="flex flex-wrap items-center justify-end gap-3 mt-6">
                <button onClick={() => onVote(proposal.id, true)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-matrix-green border border-matrix-green/30 rounded-xl hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-matrix-green/10">
                  <CheckCircle2 size={16} /> Aprobar
                </button>
                <button onClick={() => onVote(proposal.id, false)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-rose-600 border border-rose-500/30 rounded-xl hover:bg-rose-500 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-rose-500/10">
                  <XCircle size={16} /> Rechazar
                </button>
                <button onClick={() => onExecute(proposal.id)} disabled={proposal.executed} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 border border-indigo-500/30 rounded-xl hover:bg-indigo-500 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-indigo-500/10 disabled:bg-gray-400 dark:disabled:bg-gray-700 disabled:border-transparent disabled:opacity-70 disabled:hover:scale-100 disabled:shadow-none disabled:cursor-not-allowed ml-2">
                  <PlayCircle size={16} /> {proposal.executed ? 'Ejecutada' : (t('dao.execute') || 'Ejecutar Trx')}
                </button>
              </footer>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Componente Auxiliar para mostrar detalles y evitar repetición ---
const DetailItem = ({ label, value, onCopy, isMono, isLink }) => {
  if (!value || value === '-') return null;
  const { t } = useTranslation();
  return (
    <div className="bg-gray-50/80 dark:bg-dark-surface-secondary/20 p-4 rounded-2xl border border-dark-border/5 dark:border-dark-border/10">
      <div className="text-[10px] font-black uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-widest">{label}</div>
      <div className={`flex items-center justify-between gap-3 mt-1.5 text-sm ${isMono ? 'font-mono' : 'font-semibold'} text-light-text-primary dark:text-dark-text-primary`}>
        {isLink ? (
          <a href={isLink} target="_blank" rel="noopener noreferrer" className="truncate text-indigo-500 hover:text-indigo-400 hover:underline">{value}</a>
        ) : (
          <span className="truncate">{value}</span>
        )}
        {onCopy && (
          <button onClick={() => onCopy(value)} className="p-1.5 rounded-lg border border-transparent hover:border-dark-border/10 dark:hover:border-dark-border/30 hover:bg-white dark:hover:bg-dark-surface text-light-text-secondary dark:text-dark-text-secondary hover:text-matrix-green transition-all shadow-sm" title={t('common.copy') || 'Copiar'}>
            <Copy size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

// --- Componente Principal: DaoGovernance ---
const DaoGovernance = ({ appState }) => {
  const { t } = useTranslation();
  const dao = useDaoMeritocracy(appState, t);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dao.listDaoProposals();
      setProposals(res?.proposals || []);
    } catch (e) {
      toast.error(e?.message || 'Error listando propuestas');
    } finally {
      setLoading(false);
    }
  }, [dao]);

  useEffect(() => {
    const hasAuth = !!(appState?.walletAddress || appState?.account) && !!appState?.token;
    if (hasAuth) {
      refresh().catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState?.walletAddress, appState?.account, appState?.token]);
  
  const onVote = async (id, support) => {
    try {
      const result = await dao.voteProposal({ proposalId: id, support });
      if (result?.hash) {
        toast.success(`${t('dao.vote_sent') || 'Voto enviado con éxito'}. Hash: ${result.hash.slice(0, 10)}...` );
      }
      setTimeout(() => refresh().catch(console.error), 5000);
    } catch (e) {
      toast.error(e?.message || 'Error al votar');
    }
  };

  const onExecute = async (id) => {
    try {
      const result = await dao.executeProposal({ proposalId: id });
      if (result?.hash) {
        toast.success(`${t('dao.execute_sent') || 'Ejecución enviada con éxito'}. Hash: ${result.hash.slice(0, 10)}...` );
      }
      setTimeout(() => refresh().catch(console.error), 7000);
    } catch (e) {
      toast.error(e?.message || 'Error al ejecutar');
    }
  };

  const handleToggle = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/40 dark:bg-dark-surface-secondary/20 p-5 rounded-3xl border border-dark-border/10 dark:border-dark-border/20">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-matrix-green/10 rounded-2xl">
             <Landmark size={24} className="text-matrix-green" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-light-text-primary dark:text-dark-text-primary tracking-tight">{t('dao.title') || 'Gobernanza DAO'}</h2>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5">Propuestas de contratos inteligentes pendientes de aprobación y ejecución.</p>
          </div>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-2xl bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary border border-dark-border/15 dark:border-dark-border/30 hover:scale-[1.02] active:scale-[0.98] shadow-sm disabled:opacity-60 disabled:hover:scale-100 transition-all"
          disabled={loading}
        >
          {loading ? <LoaderCircle size={16} className="animate-spin text-matrix-green" /> : <RefreshCcw size={16} className="text-matrix-green" />}
          {loading ? (t('common.loading') || 'Cargando...') : (t('common.refresh') || 'Refrescar')}
        </button>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {loading && proposals.length === 0 ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-24 gap-4">
               <div className="relative">
                 <div className="absolute inset-0 blur-xl bg-matrix-green/20 rounded-full animate-pulse" />
                 <LoaderCircle size={40} className="animate-spin text-matrix-green relative z-10" />
               </div>
               <span className="font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('dao.loading_proposals') || 'Cargando propuestas en la blockchain...'}</span>
            </motion.div>
          ) : proposals.length > 0 ? (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {proposals.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  isExpanded={expandedId === p.id}
                  onToggle={() => handleToggle(p.id)}
                  onVote={onVote}
                  onExecute={onExecute}
                  appState={appState}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center justify-center py-20 px-6 rounded-[32px] bg-white/60 dark:bg-dark-surface-secondary/40 border-2 border-dashed border-dark-border/15 dark:border-dark-border/30">
              <div className="p-4 bg-gray-100 dark:bg-dark-surface rounded-2xl mb-4">
                <Info size={40} className="text-light-text-secondary dark:text-dark-text-secondary opacity-60" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary text-center">
                {t('dao.no_proposals') || 'No tienes propuestas pendientes'}
              </h3>
              <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary text-center max-w-sm">
                {t('dao.try_refresh') || 'El buzón de gobernanza de la DAO está vacío por ahora. Intenta refrescar más tarde.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DaoGovernance;