// ── Shared primitives for BannerModal tabs ────────────────────────────────────
// Uses the project's light-*/dark-* design system with tailwind dark mode.

export const inputCls = "w-full rounded-xl px-3.5 py-2.5 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-light-text-primary dark:text-dark-text-primary text-sm outline-none border border-light-border/50 dark:border-dark-border/50 focus:border-light-accent dark:focus:border-dark-accent transition placeholder:text-light-text-secondary/40 dark:placeholder:text-dark-text-secondary/40";

export const textareaCls = `${inputCls} resize-none min-h-[72px]`;

export const timeCls = "rounded-lg px-2.5 py-1.5 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-light-text-primary dark:text-dark-text-primary text-xs outline-none border border-light-border/50 dark:border-dark-border/50 focus:border-light-accent dark:focus:border-dark-accent transition w-28";

export const numberOrNull = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

export const Field = ({ label, hint, children, className = '' }) => (
    <label className={`block ${className}`}>
        <span className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1.5 uppercase tracking-wider">
            {label}
            {hint && <span className="ml-1 font-normal normal-case tracking-normal opacity-60">{hint}</span>}
        </span>
        {children}
    </label>
);

export const SectionTitle = ({ icon: Icon, children }) => (
    <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-4 h-4 text-light-accent dark:text-dark-accent" />}
        <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{children}</h3>
    </div>
);

export const Pill = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all
            ${active
                ? 'bg-light-accent dark:bg-dark-accent text-white shadow-sm'
                : 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
            }`}
    >
        {children}
    </button>
);
