import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function CameraForm({ onSubmit, saving, locations = [] }) {
  const { t } = useTranslation();
  const [locationId, setLocationId] = useState('');
  const [section, setSection] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState('local');
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState(8554);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rtspPath, setRtspPath] = useState('/profile0');
  const [retentionDays, setRetentionDays] = useState(30);
  const [vpnUser, setVpnUser] = useState('');
  const [vpnPass, setVpnPass] = useState('');
  const [ovpnFile, setOvpnFile] = useState(null);

  useEffect(() => {
    if (locations.length > 0 && !locationId) {
      const first = locations[0];
      const id = String(first?._id ?? first?.id ?? '');
      setLocationId(id);
    }
  }, [locations, locationId]);

  const canSubmit = useMemo(() => name.trim().length > 0 && (!!locationId) && (mode === 'local' ? true : !!ovpnFile), [name, locationId, mode, ovpnFile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      mode,
      location_id: locationId || undefined,
      section: section.trim() || undefined,
      description: description.trim() || undefined,
      local: { ip: ip || undefined, port: port || 8554, username: username || undefined, password: password || undefined, rtsp_path: rtspPath || '/profile0' },
      vpn: mode === 'vpn' ? { enabled: true, username: vpnUser || undefined, password: vpnPass || undefined } : undefined,
      retention_days: Number.isFinite(retentionDays) ? Math.max(1, Math.min(365, parseInt(retentionDays, 10) || 30)) : 30,
    };
    const res = await onSubmit(payload, { ovpnFile: mode === 'vpn' ? ovpnFile : null });
    return res;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-dark-surface p-3 rounded-xl border border-dark-border">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <select className="bg-dark-surface-secondary rounded-md px-3 py-2 md:col-span-2" value={locationId} onChange={e=>setLocationId(e.target.value)}>
          <option value="">{t('camera.form.select_location')}</option>
          {locations.map(loc => {
            const id = String(loc?._id ?? loc?.id ?? '');
            return <option key={id} value={id}>{loc?.nombre || id}</option>
          })}
        </select>
        <input className="bg-dark-surface-secondary rounded-md px-3 py-2" placeholder={t('camera.form.section')} value={section} onChange={e=>setSection(e.target.value)} />
        <input className="bg-dark-surface-secondary rounded-md px-3 py-2" placeholder={t('camera.form.description')} value={description} onChange={e=>setDescription(e.target.value)} />
      </div>

      <div className="flex gap-2">
        <input className="flex-1 bg-dark-surface-secondary rounded-md px-3 py-2" placeholder={t('camera.name')} value={name} onChange={e=>setName(e.target.value)} />
        <select className="bg-dark-surface-secondary rounded-md px-3 py-2" value={mode} onChange={e=>setMode(e.target.value)}>
          <option value="local">{t('camera.local')}</option>
          <option value="vpn">{t('camera.vpn')}</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="text-xs block mb-1">{t('camera.retention_days') || 'Retention (days)'}</label>
          <input
            className="bg-dark-surface-secondary rounded-md px-3 py-2 w-full"
            type="number"
            min={1}
            max={365}
            value={retentionDays}
            onChange={e=>setRetentionDays(parseInt(e.target.value || '30', 10))}
          />
        </div>
      </div>

      {mode === 'local' && (
        <div className="grid grid-cols-2 gap-2">
          <input className="bg-dark-surface-secondary rounded-md px-3 py-2 col-span-2" placeholder={t('camera.ip')} value={ip} onChange={e=>setIp(e.target.value)} />
          <input className="bg-dark-surface-secondary rounded-md px-3 py-2" placeholder={t('camera.port')} type="number" value={port} onChange={e=>setPort(parseInt(e.target.value||'8554',10))} />
          <input className="bg-dark-surface-secondary rounded-md px-3 py-2" placeholder={t('camera.rtsp_path')} value={rtspPath} onChange={e=>setRtspPath(e.target.value)} />
          <input className="bg-dark-surface-secondary rounded-md px-3 py-2" placeholder={t('camera.username')} value={username} onChange={e=>setUsername(e.target.value)} />
          <input className="bg-dark-surface-secondary rounded-md px-3 py-2" placeholder={t('camera.password')} type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
      )}

      {mode === 'vpn' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input className="bg-dark-surface-secondary rounded-md px-3 py-2 col-span-2" placeholder={t('camera.internal_ip')} value={ip} onChange={e=>setIp(e.target.value)} />
            <input className="bg-dark-surface-secondary rounded-md px-3 py-2" placeholder={t('camera.port')} type="number" value={port} onChange={e=>setPort(parseInt(e.target.value||'8554',10))} />
            <input className="bg-dark-surface-secondary rounded-md px-3 py-2" placeholder={t('camera.rtsp_path')} value={rtspPath} onChange={e=>setRtspPath(e.target.value)} />
            <input className="bg-dark-surface-secondary rounded-md px-3 py-2" placeholder={t('camera.username')} value={username} onChange={e=>setUsername(e.target.value)} />
            <input className="bg-dark-surface-secondary rounded-md px-3 py-2" placeholder={t('camera.password')} type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="bg-dark-surface-secondary rounded-md px-3 py-2" placeholder={t('camera.vpn_user')} value={vpnUser} onChange={e=>setVpnUser(e.target.value)} />
            <input className="bg-dark-surface-secondary rounded-md px-3 py-2" placeholder={t('camera.vpn_pass')} type="password" value={vpnPass} onChange={e=>setVpnPass(e.target.value)} />
          </div>
          <input type="file" accept=".ovpn" onChange={e=>setOvpnFile(e.target.files?.[0]||null)} className="text-sm" />
        </div>
      )}

      <div className="flex justify-end">
        <button disabled={saving || !canSubmit} className="px-4 py-2 rounded-md bg-dark-accent text-white disabled:opacity-50">
          {saving ? t('camera.saving') : t('camera.save')}
        </button>
      </div>
    </form>
  );
}
