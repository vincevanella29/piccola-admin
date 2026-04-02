import { useEffect, useState } from 'react';

export const useIsDark = () => {
  const get = () =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false;
  const [isDark, setIsDark] = useState(get);
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() =>
      setIsDark(el.classList.contains('dark'))
    );
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
};

export const makeSelectStyles = (isDark) => ({
  control: (base, state) => ({
    ...base,
    background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(249, 250, 251, 0.5)',
    minHeight: 46,
    borderRadius: '1rem',
    borderWidth: '1px',
    borderColor: state.isFocused
      ? '#6366f1'
      : (isDark ? '#374151' : '#e5e7eb'),
    boxShadow: state.isFocused
      ? '0 0 0 3px rgba(99, 102, 241, .2)'
      : 'none',
    ':hover': { borderColor: '#6366f1' },
    backdropFilter: 'blur(12px)',
    transition: 'all 0.2s ease',
  }),
  menu: (base) => ({
    ...base,
    background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
    borderRadius: '1rem',
    overflow: 'hidden',
    backdropFilter: 'blur(24px)',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    zIndex: 99999,
  }),
  option: (base, state) => ({
    ...base,
    background: state.isSelected ? '#6366f1' : state.isFocused ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)') : 'transparent',
    color: state.isSelected ? '#ffffff' : 'inherit',
    cursor: 'pointer',
    padding: '10px 16px',
    ':active': { background: '#4f46e5' },
  }),
  multiValue: (base) => ({
    ...base,
    background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)',
    borderRadius: '8px',
    margin: '2px 4px 2px 0',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: isDark ? '#a5b4fc' : '#4338ca',
    fontWeight: '600',
    fontSize: '0.85rem',
    padding: '4px 8px',
  }),
  multiValueRemove: (base) => ({
    ...base,
    borderRadius: '0 8px 8px 0',
    ':hover': {
      background: 'rgba(239,68,68,0.2)',
      color: '#ef4444',
    },
  }),
  input: (base) => ({ ...base, color: 'inherit' }),
  singleValue: (base) => ({ ...base, color: 'inherit' }),
  placeholder: (base) => ({
    ...base,
    color: isDark ? '#9ca3af' : '#6b7280',
  }),
});

export function sucLabel(s) {
  const id = s?.id_sucursal ?? s?.value ?? s;
  const sigla = s?.sigla || '';
  const nombre = s?.location?.nombre || s?.nombre || s?.label || '';
  return `#${id}${sigla ? ` · ${sigla}` : ''}${nombre ? ` · ${nombre}` : ''}`;
}
export function empLabel(e) {
  const id = e?._id || e?.value || e;
  const slug = e?.slug || '';
  const nombre = e?.nombre || e?.label || '';
  return `${nombre}${slug ? ` · ${slug}` : ''} · (${id})`;
}

export const ROLE_LEVEL_OPTIONS = [
  { value: 3, label: 'Nivel 3 — DOMINUS_SAPORIS (full acceso)' },
  { value: 4, label: 'Nivel 4 — CENTURIO_MENSARUM' },
  { value: 5, label: 'Nivel 5 — MILITES_CULINAE' },
];
