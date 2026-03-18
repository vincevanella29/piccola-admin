// ── Shared primitives for LocationModal tabs ──────────────────────────────────
// Reusable across InfoTab, HorariosTab, MediaTab, QrTab
// Uses the project's light-*/dark-* design system with tailwind dark mode.

export const inputCls = "w-full rounded-xl px-3.5 py-2.5 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-light-text-primary dark:text-dark-text-primary text-sm outline-none border border-light-border/50 dark:border-dark-border/50 focus:border-light-accent dark:focus:border-dark-accent transition placeholder:text-light-text-secondary/40 dark:placeholder:text-dark-text-secondary/40";

export const timeCls = "rounded-lg px-2.5 py-1.5 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-light-text-primary dark:text-dark-text-primary text-xs outline-none border border-light-border/50 dark:border-dark-border/50 focus:border-light-accent dark:focus:border-dark-accent transition w-24";

export const numberOrNull = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

export const Field = ({ label, children, className = '' }) => (
    <label className={`block ${className}`}>
        <span className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1.5 uppercase tracking-wider">
            {label}
        </span>
        {children}
    </label>
);
