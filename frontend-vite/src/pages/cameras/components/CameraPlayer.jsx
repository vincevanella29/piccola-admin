// src/components/CameraPlayer.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FiLoader, FiAlertTriangle, FiArrowUp, FiArrowDown, FiArrowLeft, FiArrowRight, FiZoomIn, FiZoomOut, FiTarget, FiClock, FiSearch, FiFilm } from 'react-icons/fi';

export default function CameraPlayer({ camera, autoPlay = true, muted = true, listRecordings, playLive, onPtz }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [statusText, setStatusText] = useState(t('camera.connecting', 'Conectando...'));
  const [isHovered, setIsHovered] = useState(false);
  const isRealTime = camera.live_enabled;

  const [mode, setMode] = useState(isRealTime ? 'live' : 'near-live');
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  
  const [availableRecordings, setAvailableRecordings] = useState([]);

  const loadNearLive = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStatusText(t('camera.loading_latest', 'Cargando último video...'));
      const end = new Date();
      const start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
      const segments = await listRecordings(camera.id, { start: start.toISOString(), end: end.toISOString() });
      if (!segments || segments.length === 0) throw new Error(t('camera.no_recent_recordings', 'No hay grabaciones recientes.'));
      
      setPlaylist(segments);
      setCurrentIndex(Math.max(0, segments.length - 2));
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [camera.id, listRecordings, t]);

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setAvailableRecordings([]);
    try {
      setStatusText(t('camera.fetching_inventory', 'Obteniendo lista de videos...'));
      const segments = await listRecordings(camera.id, {}); 
      if (!segments || segments.length === 0) throw new Error(t('camera.no_recordings_found', 'No se encontraron grabaciones.'));
      
      setAvailableRecordings(segments);
      setPlaylist(segments);
      setCurrentIndex(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [camera.id, listRecordings, t]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isRealTime) {
      let hlsDestroy = () => {};
      setStatusText(t('camera.connecting', 'Conectando...'));
      setIsLoading(true);
      playLive(video, camera.id)
        .then(({ destroy }) => { hlsDestroy = destroy; setIsLoading(false); setError(null); })
        .catch(e => { setError(e.message || 'Error en vivo'); setIsLoading(false); });
      return () => { try { hlsDestroy(); } catch {} };
    }
    
    if (mode === 'near-live') loadNearLive();
    
    const onEnded = () => {
      if (currentIndex < playlist.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    };
    video.addEventListener('ended', onEnded);
    return () => video.removeEventListener('ended', onEnded);
  }, [isRealTime, camera.id, playLive, mode, loadNearLive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isRealTime || currentIndex < 0 || !playlist[currentIndex]) return;
    const segment = playlist[currentIndex];
    video.src = segment.url;
    video.play().catch(() => {});
    setStatusText(new Date(segment.started_at).toLocaleString());
  }, [currentIndex, playlist, isRealTime]);
  
  const handleRecordingSelect = (e) => {
    const selectedStartTime = e.target.value;
    const newIndex = availableRecordings.findIndex(rec => rec.started_at === selectedStartTime);
    if (newIndex !== -1) {
      setCurrentIndex(newIndex);
    }
  };
  
  const PtzButton = ({ direction, icon, title }) => (
    <button title={title} onMouseDown={() => onPtz(camera.id, direction)} onMouseUp={() => onPtz(camera.id, 'stop')}
      className="transition-colors bg-black/50 hover:bg-black/80 text-white rounded-md flex items-center justify-center w-10 h-10 text-lg">
      {icon}
    </button>
  );

  return (
    <div className="relative rounded-lg border border-dark-border overflow-hidden bg-black aspect-video group" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <video ref={videoRef} playsInline autoPlay={autoPlay} muted={muted} controls={!isRealTime} preload="metadata" className="w-full h-full object-contain" />

      {(isLoading || error) && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-center p-4 z-10">
          {error ? (
            <><FiAlertTriangle className="text-red-400 text-3xl mb-2" /><div className="text-sm font-semibold text-red-400">{error}</div></>
          ) : (
            <><FiLoader className="text-white/80 text-3xl animate-spin mb-2" /><div className="text-sm font-semibold text-white/90">{statusText}</div></>
          )}
        </div>
      )}

      <div className={`absolute inset-0 z-20 transition-opacity duration-300 ${isHovered && !isLoading && !error ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/50 pointer-events-none"></div>
        <div className="absolute top-0 left-0 right-0 p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isRealTime && <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>}
            <div className="text-xs font-bold text-white drop-shadow-md">{camera.name}</div>
          </div>
          {!isLoading && <div className="text-xs font-medium text-white bg-black/30 px-2 py-0.5 rounded-full">{statusText}</div>}
        </div>

        {isRealTime ? (
          <>
            {/* --- CÓDIGO RESTAURADO DE CONTROLES PTZ --- */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="grid grid-cols-3 grid-rows-3 gap-1 w-[132px] h-[132px]">
                <div className="col-start-2 row-start-1 flex justify-center"><PtzButton direction="up" icon={<FiArrowUp />} title="Arriba" /></div>
                <div className="col-start-1 row-start-2 flex justify-start"><PtzButton direction="left" icon={<FiArrowLeft />} title="Izquierda" /></div>
                <div className="col-start-3 row-start-2 flex justify-end"><PtzButton direction="right" icon={<FiArrowRight />} title="Derecha" /></div>
                <div className="col-start-2 row-start-3 flex justify-center"><PtzButton direction="down" icon={<FiArrowDown />} title="Abajo" /></div>
                <div className="col-start-2 row-start-2 flex justify-center items-center"><button title="Centrar" onClick={() => onPtz(camera.id, 'center')} className="w-8 h-8 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center"><FiTarget /></button></div>
              </div>
            </div>
            <div className="absolute bottom-2 right-2 flex flex-col gap-1">
                <PtzButton direction="zoom_in" icon={<FiZoomIn />} title="Zoom In" />
                <PtzButton direction="zoom_out" icon={<FiZoomOut />} title="Zoom Out" />
            </div>
          </>
        ) : (
          <div className="absolute bottom-0 left-0 right-0 p-2 space-y-2">
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setMode('near-live')} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${mode === 'near-live' ? 'bg-dark-accent text-white' : 'bg-black/50 text-white/80 hover:bg-black/70'}`}><FiClock /> Casi en Vivo</button>
              <button onClick={() => { setMode('vod'); fetchInventory(); }} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${mode === 'vod' ? 'bg-dark-accent text-white' : 'bg-black/50 text-white/80 hover:bg-black/70'}`}><FiSearch /> Buscar Grabación</button>
            </div>
            
            {mode === 'vod' && availableRecordings.length > 0 && (
              <div className="p-2 bg-black/40 rounded-lg backdrop-blur-sm">
                <select 
                  onChange={handleRecordingSelect} 
                  value={playlist[currentIndex]?.started_at || ''}
                  className="w-full bg-dark-surface text-sm rounded-md px-2 py-1 border-0 outline-none appearance-none text-center"
                >
                  {availableRecordings.map((rec) => (
                    <option key={rec.filename} value={rec.started_at}>
                      {new Date(rec.started_at).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}