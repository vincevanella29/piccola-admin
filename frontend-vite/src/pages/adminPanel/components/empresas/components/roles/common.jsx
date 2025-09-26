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
    background: 'transparent',
    borderColor: state.isFocused
      ? (isDark ? 'var(--dark-accent, #009246)' : 'var(--light-accent, #009246)')
      : (isDark ? 'var(--dark-border, #333333)' : 'var(--light-border, #D1D5DB)'),
    boxShadow: state.isFocused
      ? `0 0 0 3px rgba(${isDark ? '0,146,70' : '0,146,70'}, .25)`
      : 'none',
    minHeight: 44,
    ':hover': {
      borderColor: isDark ? 'var(--dark-accent, #009246)' : 'var(--light-accent, #009246)',
    },
  }),
  menu: (base) => ({
    ...base,
    background: isDark ? 'var(--dark-surface, #1A1A1A)' : 'var(--light-surface, #FFFFFF)',
    border: `1px solid ${isDark ? 'var(--dark-border, #333333)' : 'var(--light-border, #D1D5DB)'}`,
    overflow: 'hidden',
    backdropFilter: 'blur(8px)',
  }),
  option: (base, state) => ({
    ...base,
    background: state.isFocused ? 'rgba(0,146,70,.12)' : 'transparent',
    color: 'inherit',
  }),
  multiValue: (base) => ({ ...base, background: 'rgba(0,146,70,.14)' }),
  multiValueLabel: (base) => ({ ...base, color: 'inherit' }),
  input: (base) => ({ ...base, color: 'inherit' }),
  singleValue: (base) => ({ ...base, color: 'inherit' }),
  placeholder: (base) => ({
    ...base,
    color: isDark ? 'var(--dark-text-secondary, #B0B0B0)' : 'var(--light-text-secondary, #6B7280)',
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
