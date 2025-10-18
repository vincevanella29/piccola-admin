// src/pages/cameras/cameras.jsx
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiGrid, FiSettings, FiVideo, FiTrash2, FiRefreshCw, FiPlay, FiStopCircle, FiArrowUp, FiArrowDown, FiArrowLeft, FiArrowRight, FiZoomIn, FiZoomOut, FiSquare, FiTarget } from 'react-icons/fi';

import useCameras from '../../hooks/useCameras.jsx';
import useRestaurantData from '../../hooks/useRestaurantData.jsx';
import CameraForm from './components/CameraForm.jsx';
import CameraPlayer from './components/CameraPlayer.jsx';

// --- Componente Toggle Switch ---
const ToggleSwitch = ({ checked, onChange, disabled }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="sr-only peer" />
    <div className="w-9 h-5 bg-dark-surface rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-dark-accent"></div>
  </label>
);

const CameraConfigRow = ({ camera, locationName, onAction, onPtz, saving }) => {
  const { t } = useTranslation();
  return (
    <li className="p-3 rounded-md bg-dark-surface-secondary flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex-1">
        <div className="font-medium">{camera.name}</div>
        <div className="text-xs text-dark-text-secondary flex items-center gap-2 flex-wrap">
          <span>{locationName}</span>
          {camera.section && (<><span>•</span><span>{camera.section}</span></>)}
          <span>•</span>
          <span className="font-mono bg-dark-background px-1 rounded">{camera?.local?.ip || 'sin IP'}</span>
        </div>
        {camera.description && <p className="text-xs mt-1 italic">{camera.description}</p>}
        <div className="flex items-center justify-center gap-2">
          <div className="grid grid-cols-3 gap-1">
            <button className="px-2 py-1 rounded bg-dark-surface hover:bg-dark-border col-start-2" onContextMenu={(e) => e.preventDefault()} onPointerDown={(e) => onPtzDown(camera.id, 'up', e)} onPointerUp={(e) => onPtzUp(camera.id, e)} onPointerCancel={(e) => onPtzCancel(camera.id, e)} title="Up"><FiArrowUp /></button>
            <button className="px-2 py-1 rounded bg-dark-surface hover:bg-dark-border" onContextMenu={(e) => e.preventDefault()} onPointerDown={(e) => onPtzDown(camera.id, 'left', e)} onPointerUp={(e) => onPtzUp(camera.id, e)} onPointerCancel={(e) => onPtzCancel(camera.id, e)} title="Left"><FiArrowLeft /></button>
            <button className="px-2 py-1 rounded bg-dark-surface hover:bg-dark-border" onContextMenu={(e) => e.preventDefault()} onPointerDown={(e) => onPtzDown(camera.id, 'right', e)} onPointerUp={(e) => onPtzUp(camera.id, e)} onPointerCancel={(e) => onPtzCancel(camera.id, e)} title="Right"><FiArrowRight /></button>
            <button className="px-2 py-1 rounded bg-dark-surface hover:bg-dark-border col-start-2" onContextMenu={(e) => e.preventDefault()} onPointerDown={(e) => onPtzDown(camera.id, 'down', e)} onPointerUp={(e) => onPtzUp(camera.id, e)} onPointerCancel={(e) => onPtzCancel(camera.id, e)} title="Down"><FiArrowDown /></button>
          </div>
          <div className="flex items-center gap-1">
            <button className="px-2 py-1 rounded bg-dark-surface hover:bg-dark-border" onContextMenu={(e) => e.preventDefault()} onPointerDown={(e) => onPtzDown(camera.id, 'zoom_out', e)} onPointerUp={(e) => onPtzUp(camera.id, e)} onPointerCancel={(e) => onPtzCancel(camera.id, e)} title="Zoom Out"><FiZoomOut /></button>
            <button className="px-2 py-1 rounded bg-dark-surface hover:bg-dark-border" onContextMenu={(e) => e.preventDefault()} onPointerDown={(e) => onPtzDown(camera.id, 'zoom_in', e)} onPointerUp={(e) => onPtzUp(camera.id, e)} onPointerCancel={(e) => onPtzCancel(camera.id, e)} title="Zoom In"><FiZoomIn /></button>
            <button className="px-2 py-1 rounded bg-dark-surface hover:bg-dark-border" onClick={() => onPtz(camera.id, 'center')} title="Center"><FiTarget /></button>
            <button className="px-2 py-1 rounded bg-dark-surface hover:bg-dark-border" onClick={() => onPtz(camera.id, 'stop')} title="Stop"><FiSquare /></button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <span>Real-Time HLS</span>
          <ToggleSwitch checked={camera.live_enabled} onChange={() => onAction('toggleLive', camera.id, !camera.live_enabled)} disabled={saving} />
        </div>
        <button className="text-xs px-2 py-1 rounded bg-dark-surface hover:bg-dark-border" onClick={() => onAction('refresh')}><FiRefreshCw /></button>
        <button className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/40" onClick={() => onAction('start', camera.id)}><FiPlay /></button>
        <button className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/40" onClick={() => onAction('stop', camera.id)}><FiStopCircle /></button>
        <button className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/40" onClick={() => onAction('remove', camera.id)}><FiTrash2 /></button>
      </div>
    </li>
  );
};

export default function CommandCenterPage({ appState }) {
  const { t } = useTranslation();
  const [view, setView] = useState('grid');
  const pressRef = useRef({}); // { [camId]: { t0: number, cmd: string, pid: number, handled: boolean } }
  const lastSendRef = useRef({}); // { [camId]: timestamp }

  const {
    items: cameras, loading, error, saving, saveError,
    refresh, addCamera, removeCamera, startCamera, stopCamera, ptz, toggleLive, listRecordings, playLive,
  } = useCameras(appState, { autoLoad: true });

  const { locations } = useRestaurantData(appState);

  const camerasByLocation = useMemo(() => {
    return cameras.reduce((acc, cam) => {
      const locId = String(cam.location_id || 'unassigned');
      if (!acc[locId]) acc[locId] = [];
      acc[locId].push(cam);
      return acc;
    }, {});
  }, [cameras]);

  const handleSubmit = useCallback(async (payload, opts) => {
    const res = await addCamera(payload);
    if (res?.id) {
      try { await startCamera(res.id); } catch {}
    }
    return res;
  }, [addCamera, startCamera]);

  // PTZ press handlers: record start and command; on release, send a single duration-based move.
  const onPtzDown = useCallback((camId, command, e) => {
    try { e?.preventDefault?.(); e?.stopPropagation?.(); } catch {}
    const pid = e?.pointerId ?? 0;
    const isPrimary = e?.isPrimary ?? true;
    if (!isPrimary) return;
    try { e?.currentTarget?.setPointerCapture?.(pid); } catch {}
    pressRef.current[camId] = { t0: Date.now(), cmd: command, pid, handled: false };
  }, []);

  const onPtzUp = useCallback((camId, e) => {
    try { e?.preventDefault?.(); e?.stopPropagation?.(); } catch {}
    const pid = e?.pointerId ?? 0;
    const isPrimary = e?.isPrimary ?? true;
    if (!isPrimary) return;
    const rec = pressRef.current[camId];
    if (!rec || rec.handled || (rec.pid && rec.pid !== pid)) return;
    const now = Date.now();
    const last = lastSendRef.current[camId] || 0;
    if (now - last < 150) { delete pressRef.current[camId]; return; }
    const ms = Math.max(50, now - rec.t0);
    lastSendRef.current[camId] = now;
    rec.handled = true;
    ptz(camId, rec.cmd, ms);
    delete pressRef.current[camId];
  }, [ptz]);

  const onPtzCancel = useCallback((camId, e) => {
    try { e?.preventDefault?.(); e?.stopPropagation?.(); } catch {}
    // Treat cancel as an immediate release
    onPtzUp(camId, e);
  }, [onPtzUp]);

  const handleCameraAction = (action, camId, value) => {
    switch (action) {
      case 'refresh': refresh(); break;
      case 'start': startCamera(camId); break;
      case 'stop': stopCamera(camId); break;
      case 'toggleLive': toggleLive(camId, value); break;
      case 'remove': if (window.confirm(t('camera.confirm_remove'))) removeCamera(camId); break;
      default: break;
    }
  };
  
  return (
    <div className="min-h-[100svh] bg-dark-background text-dark-text-primary">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FiVideo /> {t('camera.command_center_title')}</h1>
            <p className="text-sm text-dark-text-secondary">{t('camera.command_center_desc')}</p>
          </div>
          <div className="flex items-center gap-2 p-1 rounded-lg bg-dark-surface border border-dark-border">
            <button onClick={() => setView('grid')} className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 ${view === 'grid' ? 'bg-dark-accent text-white' : 'hover:bg-dark-surface-secondary'}`}><FiGrid /> {t('camera.grid_view')}</button>
            <button onClick={() => setView('config')} className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 ${view === 'config' ? 'bg-dark-accent text-white' : 'hover:bg-dark-surface-secondary'}`}><FiSettings /> {t('camera.config_view')}</button>
          </div>
        </header>

        {view === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {loading && <div className="col-span-full text-center py-10">{t('camera.loading')}</div>}
            {error && <div className="text-red-400 col-span-full">{error}</div>}
            {cameras.map(cam => (
              <CameraPlayer
                key={cam.id}
                camera={cam}
                listRecordings={listRecordings}
                playLive={playLive}
                onPtz={ptz} // <--- Le pasamos la función PTZ al player
              />
            ))}
            {cameras.length === 0 && !loading && <div className="col-span-full text-center py-10 text-dark-text-secondary">{t('camera.no_cameras_grid')}</div>}
          </div>
        )}

        {view === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <CameraForm onSubmit={handleSubmit} saving={saving} locations={locations} />
              {saveError && <div className="mt-2 text-sm text-red-400">{saveError}</div>}
            </div>
            <div className="lg:col-span-2">
              <h3 className="font-semibold text-base mb-3">{t('camera.registered_cameras')}</h3>
              {loading ? <div>{t('camera.loading')}</div> : error ? <div className="text-red-400">{error}</div> : (
                <div className="space-y-6">
                  {locations.map(loc => {
                    const locId = String(loc?._id ?? loc?.id ?? '');
                    const list = camerasByLocation[locId] || [];
                    return list.length > 0 ? (
                      <div key={locId}>
                        <h4 className="font-semibold text-dark-text-secondary mb-2">{loc?.nombre || locId}</h4>
                        <ul className="space-y-2">
                          {list.map(cam => (
                            <CameraConfigRow key={cam.id} camera={cam} locationName={loc?.nombre || locId} onAction={handleCameraAction} onPtz={(id, cmd) => (cmd === 'stop' ? onPtzUp(id) : onPtzDown(id, cmd))} saving={saving} />
                          ))}
                        </ul>
                      </div>
                    ) : null;
                  })}
                  {(camerasByLocation['unassigned'] || []).length > 0 && (
                    <div>
                      <h4 className="font-semibold text-dark-text-secondary mb-2">{t('camera.unassigned')}</h4>
                      <ul className="space-y-2">
                        {(camerasByLocation['unassigned'] || []).map(cam => (
                          <CameraConfigRow key={cam.id} camera={cam} locationName={t('camera.unassigned')} onAction={handleCameraAction} onPtz={(id, cmd) => (cmd === 'stop' ? onPtzUp(id) : onPtzDown(id, cmd))} saving={saving} />
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const pageMetadata = {
  path: '/app/cameras',
  label: 'camera.label',
  category: 'admin.tools.category',
  minRoleLevel: 3,
  maxRoleLevel: 4,
  order: 2,
  locations: ['sidebar'],
  description: 'camera.description',
  icon: 'FaTools',
  isMainPage: true,
  isSearchable: true,
};
