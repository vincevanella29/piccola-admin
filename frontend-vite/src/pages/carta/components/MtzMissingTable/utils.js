// ── Formatting helpers ────────────────────────────────────────────────────────

export const CLP = (v) =>
    v != null ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v) : '—';

export const NUM = (v) =>
    v != null ? new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(v) : '—';

export const MONTH_LABEL = (mesano) => {
    if (!mesano || mesano.length !== 6) return mesano;
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const y = mesano.slice(0, 4);
    const m = parseInt(mesano.slice(4, 6), 10);
    return `${months[m - 1] || m} ${y}`;
};

// LocalStorage key for inactive families/products
export const INACTIVE_KEY = 'mtz_inactive_codigos';

export const loadInactive = () => {
    try { return new Set(JSON.parse(localStorage.getItem(INACTIVE_KEY) || '[]')); }
    catch { return new Set(); }
};

export const saveInactive = (set) => {
    localStorage.setItem(INACTIVE_KEY, JSON.stringify(Array.from(set)));
};
