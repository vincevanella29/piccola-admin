/**
 * CategoryDropdowns — Reusable dropdowns for category table actions
 * Contains: MoveToDropdown, CopyToDropdown, BulkMoveDropdown
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRightLeft, ChevronDown, Loader2, Copy } from 'lucide-react';

// ── "Move to" dropdown ────────────────────────────────────────────────────────
export const MoveToDropdown = ({ currentType, menuTypes, onMove, loading, align = 'right' }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const otherTypes = menuTypes.filter(mt => mt.slug !== currentType);
    if (otherTypes.length === 0) return null;

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500 dark:hover:text-blue-400 hover:border-blue-400/30 text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                title="Mover a otra carta"
            >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                <span className="hidden lg:inline">Mover</span>
                <ChevronDown className="w-3 h-3" />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className={`absolute z-50 ${align === 'left' ? 'left-0' : 'right-0'} top-full mt-1 min-w-[160px] bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl shadow-xl shadow-black/10 dark:shadow-black/30 py-1 overflow-hidden`}
                    >
                        <p className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-light-text-secondary/60 dark:text-dark-text-secondary/60">
                            Mover a…
                        </p>
                        {otherTypes.map(mt => (
                            <button
                                key={mt.slug}
                                onClick={(e) => { e.stopPropagation(); onMove(mt.slug); setOpen(false); }}
                                className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-semibold text-light-text-primary dark:text-dark-text-primary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors"
                            >
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: mt.color }} />
                                {mt.name}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ── "Copy to" dropdown — duplicates category to another menu type ─────────────
export const CopyToDropdown = ({ currentType, menuTypes, onCopy, loading, align = 'right' }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const otherTypes = menuTypes.filter(mt => mt.slug !== currentType);
    if (otherTypes.length === 0) return null;

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-purple-500 dark:hover:text-purple-400 hover:border-purple-400/30 text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                title="Copiar categoría a otra carta"
            >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden lg:inline">Copiar</span>
                <ChevronDown className="w-3 h-3" />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className={`absolute z-50 ${align === 'left' ? 'left-0' : 'right-0'} top-full mt-1 min-w-[160px] bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl shadow-xl shadow-black/10 dark:shadow-black/30 py-1 overflow-hidden`}
                    >
                        <p className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-light-text-secondary/60 dark:text-dark-text-secondary/60">
                            Copiar a…
                        </p>
                        {otherTypes.map(mt => (
                            <button
                                key={mt.slug}
                                onClick={(e) => { e.stopPropagation(); onCopy(mt.slug); setOpen(false); }}
                                className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-semibold text-light-text-primary dark:text-dark-text-primary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors"
                            >
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: mt.color }} />
                                {mt.name}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ── Bulk move dropdown (in header) ────────────────────────────────────────────
export const BulkMoveDropdown = ({ menuTypes, count, onBulkMove, loading }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    if (count === 0 || menuTypes.length <= 1) return null;

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-400/30 text-blue-600 dark:text-blue-400 text-xs font-bold transition-all hover:bg-blue-500/15 disabled:opacity-50"
            >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                Mover {count} a…
                <ChevronDown className="w-3 h-3" />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute z-50 left-0 top-full mt-1 min-w-[180px] bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl shadow-xl shadow-black/10 dark:shadow-black/30 py-1 overflow-hidden"
                    >
                        <p className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-light-text-secondary/60 dark:text-dark-text-secondary/60">
                            Mover {count} categorías a…
                        </p>
                        {menuTypes.map(mt => (
                            <button
                                key={mt.slug}
                                onClick={() => { onBulkMove(mt.slug); setOpen(false); }}
                                className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-semibold text-light-text-primary dark:text-dark-text-primary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors"
                            >
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: mt.color }} />
                                {mt.name}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
