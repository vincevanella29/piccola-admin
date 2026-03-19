import React from 'react';
import {
  User, Mail, Phone, MapPin, Briefcase, Calendar, Ruler,
  Weight, Shirt, Footprints, Building2, IdCard,
} from 'lucide-react';

const isBlank = (v) => v === null || v === undefined || v === '' || v === 0;
const display = (v) => (isBlank(v) ? '—' : String(v));
const fmtCLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n || 0));

const compactNumber = (n) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1).replace(/\.0$/, '')}b`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(/\.0$/, '')}m`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1).replace(/\.0$/, '')}k`;
  return `${sign}${Math.round(abs)}`;
};
const money = (n = 0) => `$${compactNumber(Number(n) || 0)}`;

// ── Reusable Row ─────────────────────────────────────────────────────────────
const ProfileRow = ({ label, value, tooltip, icon: Icon }) => (
  <div className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/20 transition group">
    <div className="w-8 h-8 rounded-lg bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
    </div>
    <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex-1">{label}</span>
    {tooltip ? (
      <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary cursor-help" title={tooltip}>
        {display(value)}
      </span>
    ) : (
      <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{display(value)}</span>
    )}
  </div>
);

// ── Section Card ─────────────────────────────────────────────────────────────
const Section = ({ title, children }) => (
  <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border overflow-hidden">
    <div className="px-4 py-2.5 border-b border-light-border/50 dark:border-dark-border/50">
      <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{title}</h3>
    </div>
    <div className="px-3 py-1">
      {children}
    </div>
  </div>
);

// ── Status Badge ─────────────────────────────────────────────────────────────
const Badge = ({ label, variant = 'default' }) => {
  const colors = {
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    error: 'bg-red-500/10 text-red-500',
    default: 'bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 text-light-text-secondary dark:text-dark-text-secondary',
  };
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${colors[variant]}`}>
      {label}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
const ProfileTab = ({ t, emp }) => {
  const name = [emp?.nombres, emp?.apellidopaterno, emp?.apellidomaterno].filter(Boolean).join(' ') || t('employees.table.unknown');
  const rut = emp?.rut_str || emp?.rut || '—';
  const sexoMap = {
    f: t('employees.profile.gender.female') || 'Femenino',
    m: t('employees.profile.gender.male') || 'Masculino',
  };
  const sexo = sexoMap[String(emp?.sexo || '').toLowerCase()] || (t('employees.profile.gender.other') || 'Otro');
  const netPrev = emp?.payroll?.previous?.net || 0;
  const netAnte = emp?.payroll?.anteprevious?.net || 0;
  const delta = netAnte > 0 ? ((netPrev - netAnte) / netAnte) * 100 : netPrev > 0 ? 100 : null;

  return (
    <div className="space-y-4">
      {/* Hero summary */}
      <div className="bg-gradient-to-r from-light-accent/5 to-light-accent/10 dark:from-dark-accent/5 dark:to-dark-accent/10 rounded-2xl border border-light-border dark:border-dark-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">{name}</h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {emp?.activo && <Badge label={t('employees.profile.active')} variant="success" />}
              {!emp?.activo && <Badge label={t('employees.profile.inactive')} />}
              {emp?.nongrata && <Badge label={t('employees.profile.blacklisted')} variant="error" />}
              {emp?.rutbloqueado && <Badge label={t('employees.profile.rut_blocked')} variant="error" />}
              {emp?.ficha_privada && <Badge label={t('employees.profile.private_file')} />}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">
                {t('employees.payroll.columns.total_paid')}
              </p>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {money(emp?.payroll?.totals?.total || 0)}
              </p>
            </div>
            <div className="w-px h-10 bg-light-border dark:bg-dark-border" />
            <div className="text-right">
              <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">
                {t('employees.payroll.columns.net_previous')}
              </p>
              <div className="flex items-center gap-1.5">
                <p className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary" title={fmtCLP(netPrev)}>
                  {money(netPrev)}
                </p>
                {delta !== null && (
                  <span className={`text-xs font-bold ${delta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1).replace(/\.0$/, '')}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Personal */}
        <Section title={t('employees.profile.section.personal')}>
          <ProfileRow label={t('employees.table.name')} value={name} icon={User} />
          <ProfileRow label={t('employees.table.rut')} value={rut} icon={IdCard} />
          <ProfileRow label={t('employees.profile.gender')} value={sexo} icon={User} />
          <ProfileRow label={t('employees.profile.nationality')} value={emp?.nacionalidad} icon={MapPin} />
          <ProfileRow label={t('employees.profile.birthdate')} value={emp?.fechanacimiento} icon={Calendar} />
          <ProfileRow label={t('employees.profile.civil_status')} value={emp?.estadocivil} icon={User} />
        </Section>

        {/* Contact */}
        <Section title={t('employees.profile.section.contact')}>
          <ProfileRow label={t('employees.profile.email')} value={emp?.email || emp?.correo} icon={Mail} />
          <ProfileRow label={t('employees.profile.phone1')} value={emp?.telefonouno && emp?.telefonouno !== 0 ? emp.telefonouno : '—'} icon={Phone} />
          <ProfileRow label={t('employees.profile.phone2')} value={emp?.telefonodos && emp?.telefonodos !== 0 ? emp.telefonodos : '—'} icon={Phone} />
          <ProfileRow label={t('employees.profile.address')} value={emp?.direccion} icon={MapPin} />
          <ProfileRow label={t('employees.profile.district')} value={emp?.comuna} icon={MapPin} />
          <ProfileRow label={t('employees.profile.city')} value={emp?.ciudad} icon={MapPin} />
        </Section>

        {/* Employment */}
        <Section title={t('employees.profile.section.employment')}>
          <ProfileRow label={t('employees.table.cargo')} value={emp?.cargo} icon={Briefcase} />
          <ProfileRow label={t('employees.table.sucursal')} value={emp?.sucursal} icon={Building2} />
          <ProfileRow label={t('employees.table.ingreso')} value={emp?.fechaingreso} icon={Calendar} />
          <ProfileRow label={t('employees.profile.exit')} value={emp?.fecharetiro} icon={Calendar} />
          <ProfileRow label={t('employees.profile.salary')} value={money(emp?.sueldo)} tooltip={fmtCLP(emp?.sueldo)} icon={Briefcase} />
          <ProfileRow label={t('employees.profile.afp')} value={emp?.afp} icon={Briefcase} />
          <ProfileRow label={t('employees.profile.isapre')} value={emp?.isapre} icon={Briefcase} />
          <ProfileRow label={t('employees.profile.with_contract')} value={emp?.concontrato ? (t('common.yes') || 'Sí') : (t('common.no') || 'No')} icon={Briefcase} />
          <ProfileRow label={t('employees.profile.with_payroll')} value={emp?.conliquidacion ? (t('common.yes') || 'Sí') : (t('common.no') || 'No')} icon={Briefcase} />
          {(emp?.centro_costo_cod || emp?.centro_costo) && (
            <div className="flex flex-wrap gap-1.5 px-1 py-2">
              {emp?.centro_costo_cod && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 text-light-text-secondary dark:text-dark-text-secondary">
                  {t('employees.profile.cost_center_prefix')} {emp.centro_costo_cod}
                </span>
              )}
              {emp?.centro_costo && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 text-light-text-secondary dark:text-dark-text-secondary">
                  {emp.centro_costo}
                </span>
              )}
            </div>
          )}
        </Section>

        {/* Status + Measurements */}
        <div className="space-y-4">
          <Section title={t('employees.profile.section.status')}>
            <ProfileRow label={t('employees.profile.created_at')} value={emp?.fechacreacion} icon={Calendar} />
            <ProfileRow label={t('employees.profile.company_id')} value={emp?.id_empresa} icon={Building2} />
            <ProfileRow label={t('employees.profile.internal_id')} value={emp?.id} icon={IdCard} />
          </Section>

          <Section title={t('employees.profile.section.measurements')}>
            <ProfileRow label={t('employees.profile.height')} value={emp?.estatura} icon={Ruler} />
            <ProfileRow label={t('employees.profile.weight')} value={emp?.peso} icon={Weight} />
            <ProfileRow label={t('employees.profile.size')} value={emp?.talla} icon={Shirt} />
            <ProfileRow label={t('employees.profile.shoe')} value={emp?.zapato} icon={Footprints} />
          </Section>
        </div>
      </div>
    </div>
  );
};

export default ProfileTab;