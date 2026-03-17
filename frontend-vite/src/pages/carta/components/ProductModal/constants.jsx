// ── Shared design tokens & primitives for ProductModal ─────────────────────────

export const INPUT =
    'w-full px-3.5 py-2.5 rounded-xl ' +
    'bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 ' +
    'border border-light-border dark:border-dark-border ' +
    'text-light-text-primary dark:text-dark-text-primary ' +
    'text-sm focus:outline-none focus:ring-2 ' +
    'focus:ring-light-accent dark:focus:ring-dark-accent ' +
    'transition-shadow ' +
    'placeholder:text-light-text-secondary/50 dark:placeholder:text-dark-text-secondary/50';

export const DAYS = [
    { key: '1', label: 'Lun' },
    { key: '2', label: 'Mar' },
    { key: '3', label: 'Mié' },
    { key: '4', label: 'Jue' },
    { key: '5', label: 'Vie' },
    { key: '6', label: 'Sáb' },
    { key: '7', label: 'Dom' },
];

export const CHANNELS = [
    { key: 'dinein',     label: '🍽 Dine In',  color: 'blue'   },
    { key: 'delivery',   label: '🛵 Delivery', color: 'orange' },
    { key: 'collection', label: '🥡 Retiro',   color: 'purple' },
];

/** Inline alert helper — success or error, with close button. */
export const InlineAlert = ({ msg, onClose }) => {
    if (!msg) return null;
    const ok = msg.type === 'success';
    return (
        <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-xs font-medium mb-3 ${
            ok
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>
            <span className="flex-1 break-all">{msg.text}</span>
            {onClose && (
                <button type="button" onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100">✕</button>
            )}
        </div>
    );
};

/** Labelled field wrapper. */
export const Field = ({ label, children }) => (
    <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary tracking-wide">
            {label}
        </label>
        {children}
    </div>
);
