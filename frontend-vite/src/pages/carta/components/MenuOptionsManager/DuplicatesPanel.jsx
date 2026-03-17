import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, ChevronRight, ShieldAlert, ScanSearch, Trash2,
    Loader2, AlertTriangle, CheckCircle,
} from 'lucide-react';
import * as cartaApi from '../../../../utils/cartaData';

const DuplicatesPanel = ({ token, account, onRefresh }) => {
    const [open, setOpen] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [result, setResult] = useState(null);
    const [msg, setMsg] = useState(null);

    const scan = async () => {
        setScanning(true);
        setMsg(null);
        try {
            const data = await cartaApi.fetchDuplicateOptionCodigos({ token, account });
            setResult(data);
        } catch (err) {
            setMsg({ type: 'error', text: err.message });
        } finally {
            setScanning(false);
        }
    };

    const handleRemove = async () => {
        if (!result) return;
        const extra = result.total_extra_occurrences;
        if (!confirm(`¿Eliminar ${extra} valores duplicados de grupos de productos? Se conservará la primera ocurrencia de cada código. (Los modificadores no se ven afectados.)`)) return;
        setRemoving(true);
        setMsg(null);
        try {
            const res = await cartaApi.removeDuplicateOptionValues({ token, account, dryRun: false });
            setMsg({ type: 'success', text: `✓ ${res.deleted_count} valores eliminados correctamente` });
            setResult(null);
            onRefresh();
        } catch (err) {
            setMsg({ type: 'error', text: err.message });
        } finally {
            setRemoving(false);
        }
    };

    const dupEntries = result ? Object.entries(result.duplicates || {}) : [];
    const hasDups = result && result.total_duplicate_codigos > 0;

    return (
        <div className={`rounded-2xl border overflow-hidden transition-colors ${
            hasDups
                ? 'border-light-error dark:border-dark-error bg-light-error-5 dark:bg-dark-error-5'
                : 'border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface'
        }`}>
            <button
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors"
                onClick={() => { setOpen(o => !o); if (!open && !result) scan(); }}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        hasDups
                            ? 'bg-light-error-10 dark:bg-dark-error-10'
                            : 'bg-light-surface-secondary dark:bg-dark-surface-secondary'
                    }`}>
                        <ShieldAlert className={`w-4 h-4 ${
                            hasDups
                                ? 'text-light-error dark:text-dark-error'
                                : 'text-light-text-secondary dark:text-dark-text-secondary'
                        }`} />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">Duplicados en grupos de productos</p>
                        <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                            {result
                                ? hasDups
                                    ? `${result.total_duplicate_codigos} códigos duplicados — ${result.total_extra_occurrences} valores extra`
                                    : '✅ Sin duplicados en grupos de productos'
                                : 'Un producto solo puede estar en un grupo a la vez'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {hasDups && (
                        <span className="px-2 py-0.5 rounded-full bg-light-error dark:bg-dark-error text-light-surface dark:text-dark-background text-[10px] font-bold">
                            {result.total_duplicate_codigos}
                        </span>
                    )}
                    {open ? <ChevronDown className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                           : <ChevronRight className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />}
                </div>
            </button>

            <AnimatePresence>
            {open && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-light-border dark:border-dark-border"
                >
                    <div className="px-5 py-4 space-y-4">
                        {msg && (
                            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium border ${
                                msg.type === 'success'
                                    ? 'bg-light-success-10 dark:bg-dark-success-10 text-light-success dark:text-dark-success border-light-success-30 dark:border-dark-success-30'
                                    : 'bg-light-error-10 dark:bg-dark-error-10 text-light-error dark:text-dark-error border-light-error-30 dark:border-dark-error-30'
                            }`}>
                                {msg.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                                <span>{msg.text}</span>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button onClick={scan} disabled={scanning}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-light-border dark:border-dark-border text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:border-light-accent dark:hover:border-dark-accent hover:text-light-accent dark:hover:text-dark-accent transition-all disabled:opacity-50">
                                {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />}
                                {scanning ? 'Escaneando…' : 'Re-escanear'}
                            </button>
                            {hasDups && (
                                <button onClick={handleRemove} disabled={removing}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-light-error dark:bg-dark-error text-light-surface dark:text-dark-background text-xs font-bold hover:bg-light-error-hover dark:hover:bg-dark-error-hover transition-colors shadow-neon-error disabled:opacity-50 active:scale-95">
                                    {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                    {removing ? 'Eliminando…' : `Eliminar ${result.total_extra_occurrences} duplicados`}
                                </button>
                            )}
                        </div>

                        {dupEntries.length > 0 && (
                            <div className="rounded-xl border border-light-error-30 dark:border-dark-error-30 overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-light-error-5 dark:bg-dark-error-5 border-b border-light-error-20 dark:border-dark-error-20">
                                            <th className="px-4 py-2.5 text-left font-bold text-light-error dark:text-dark-error uppercase tracking-wider">Código</th>
                                            <th className="px-4 py-2.5 text-left font-bold text-light-error dark:text-dark-error uppercase tracking-wider">Nombre</th>
                                            <th className="px-4 py-2.5 text-left font-bold text-light-error dark:text-dark-error uppercase tracking-wider">Grupo</th>
                                            <th className="px-4 py-2.5 text-center font-bold text-light-error dark:text-dark-error uppercase tracking-wider"># copias</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-light-border dark:divide-dark-border">
                                        {dupEntries.map(([codigo, entries]) => (
                                            <tr key={codigo} className="hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors">
                                                <td className="px-4 py-2.5">
                                                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-light-error-10 dark:bg-dark-error-10 text-light-error dark:text-dark-error">{codigo}</span>
                                                </td>
                                                <td className="px-4 py-2.5 font-medium text-light-text-primary dark:text-dark-text-primary">{entries[0]?.value_name || '—'}</td>
                                                <td className="px-4 py-2.5 text-light-text-secondary dark:text-dark-text-secondary">{entries[0]?.option_name}</td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <span className="px-2 py-0.5 rounded-full bg-light-error dark:bg-dark-error text-light-surface dark:text-dark-background text-[10px] font-bold">{entries.length}x</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {result && result.total_duplicate_codigos === 0 && (
                            <div className="flex items-center gap-2 text-light-success dark:text-dark-success text-sm font-medium">
                                <CheckCircle className="w-4 h-4" /> Sin duplicados — todo limpio
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </div>
    );
};

export default DuplicatesPanel;
