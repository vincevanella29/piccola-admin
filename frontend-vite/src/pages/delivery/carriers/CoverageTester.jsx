// src/pages/delivery/components/CoverageTester.jsx
// Coverage test panel — test which carriers can deliver from a location to a destination
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaMapMarkerAlt, FaSearchLocation, FaTruck, FaCheck,
  FaTimes, FaSpinner, FaClock, FaDollarSign, FaRoute,
} from 'react-icons/fa';
import { testCoverageArea, fetchLocations } from '../../../utils/deliveryData';

const CoverageTester = ({ appState, carriers = [] }) => {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [dropoffLat, setDropoffLat] = useState('');
  const [dropoffLng, setDropoffLng] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);

  // Load locations on mount
  useEffect(() => {
    const load = async () => {
      try {
        const resp = await fetchLocations({
          token: appState?.token,
          walletAddress: appState?.account,
        });
        const locs = resp?.locations || resp?.data?.locations || resp || [];
        setLocations(Array.isArray(locs) ? locs : []);
      } catch (e) {
        console.warn('[coverage] Failed to load locations:', e);
      }
    };
    load();
  }, [appState?.token, appState?.account]);

  // Santiago preset destinations for quick testing
  const PRESETS = [
    { name: 'Las Condes', lat: -33.4087, lng: -70.5667, address: 'Av. Apoquindo 4000, Las Condes' },
    { name: 'Providencia', lat: -33.4265, lng: -70.6155, address: 'Av. Providencia 1234, Providencia' },
    { name: 'Ñuñoa', lat: -33.4565, lng: -70.5987, address: 'Av. Irarrázaval 3000, Ñuñoa' },
    { name: 'La Florida', lat: -33.5230, lng: -70.5988, address: 'Av. Vicuña Mackenna 7110, La Florida' },
    { name: 'Maipú', lat: -33.5097, lng: -70.7577, address: 'Av. Pajaritos 3000, Maipú' },
    { name: 'Santiago Centro', lat: -33.4372, lng: -70.6506, address: 'Alameda 1000, Santiago' },
    { name: 'Vitacura', lat: -33.3942, lng: -70.5735, address: 'Av. Vitacura 3000, Vitacura' },
    { name: 'Quilicura', lat: -33.3638, lng: -70.6997, address: 'Av. O\'Higgins 1000, Quilicura' },
  ];

  const handleTest = useCallback(async () => {
    if (!selectedLocation || !dropoffLat || !dropoffLng) return;
    setTesting(true);
    setResult(null);
    setError(null);

    try {
      const resp = await testCoverageArea({
        token: appState?.token,
        walletAddress: appState?.account,
        data: {
          location_id: selectedLocation,
          dropoff_lat: parseFloat(dropoffLat),
          dropoff_lng: parseFloat(dropoffLng),
          dropoff_address: dropoffAddress,
        },
      });
      setResult(resp);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Error en test de cobertura');
    } finally {
      setTesting(false);
    }
  }, [selectedLocation, dropoffLat, dropoffLng, dropoffAddress, appState]);

  const applyPreset = (preset) => {
    setDropoffLat(preset.lat.toString());
    setDropoffLng(preset.lng.toString());
    setDropoffAddress(preset.address);
    setResult(null);
  };

  const activeCarrierSlugs = carriers.filter(c => c.status === 'active').map(c => c.slug);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-8 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
            <FaSearchLocation className="text-white" size={18} />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-light-text-primary dark:text-dark-text-primary">
              Tester de Cobertura
            </h3>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              Verifica si los carriers pueden entregar desde un local a una dirección
            </p>
          </div>
        </div>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          className="text-light-text-tertiary dark:text-dark-text-tertiary"
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              {/* Location selector + destination */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pickup location */}
                <div>
                  <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                    <FaMapMarkerAlt className="inline mr-1 text-green-500" size={10} />
                    Local de Pickup
                  </label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => { setSelectedLocation(e.target.value); setResult(null); }}
                    className="w-full bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 rounded-xl px-3 py-2.5 text-sm text-light-text-primary dark:text-dark-text-primary"
                  >
                    <option value="">Selecciona un local...</option>
                    {locations.map((loc) => (
                      <option key={loc._id || loc.id} value={loc._id || loc.id}>
                        {loc.nombre} — {loc.city || loc.direccion}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination address */}
                <div>
                  <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                    <FaMapMarkerAlt className="inline mr-1 text-red-500" size={10} />
                    Dirección Destino
                  </label>
                  <input
                    type="text"
                    value={dropoffAddress}
                    onChange={(e) => setDropoffAddress(e.target.value)}
                    placeholder="Av. Apoquindo 4000, Las Condes"
                    className="w-full bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 rounded-xl px-3 py-2.5 text-sm text-light-text-primary dark:text-dark-text-primary"
                  />
                </div>
              </div>

              {/* Lat/Lng inputs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-light-text-tertiary dark:text-dark-text-tertiary mb-1 uppercase tracking-wider">
                    Latitud
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={dropoffLat}
                    onChange={(e) => { setDropoffLat(e.target.value); setResult(null); }}
                    placeholder="-33.4087"
                    className="w-full bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 rounded-lg px-3 py-2 text-sm font-mono text-light-text-primary dark:text-dark-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-light-text-tertiary dark:text-dark-text-tertiary mb-1 uppercase tracking-wider">
                    Longitud
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={dropoffLng}
                    onChange={(e) => { setDropoffLng(e.target.value); setResult(null); }}
                    placeholder="-70.5667"
                    className="w-full bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 rounded-lg px-3 py-2 text-sm font-mono text-light-text-primary dark:text-dark-text-primary"
                  />
                </div>
                <div className="col-span-2 flex items-end">
                  <button
                    onClick={handleTest}
                    disabled={testing || !selectedLocation || !dropoffLat || !dropoffLng}
                    className={`w-full px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                      testing || !selectedLocation || !dropoffLat || !dropoffLng
                        ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-cyan-500/20'
                    }`}
                  >
                    {testing ? (
                      <>
                        <FaSpinner className="animate-spin" size={14} />
                        Consultando carriers...
                      </>
                    ) : (
                      <>
                        <FaSearchLocation size={14} />
                        Probar Cobertura
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick preset buttons */}
              <div>
                <p className="text-[10px] font-semibold text-light-text-tertiary dark:text-dark-text-tertiary mb-1.5 uppercase tracking-wider">
                  Destinos rápidos
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => applyPreset(p)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                        dropoffAddress === p.address
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-500'
                          : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 dark:border-dark-border/10 text-light-text-secondary dark:text-dark-text-secondary hover:border-cyan-500/30'
                      }`}
                    >
                      📍 {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-500">
                  ❌ {error}
                </div>
              )}

              {/* Results */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-3"
                  >
                    {/* Summary */}
                    <div className={`rounded-xl p-4 border ${
                      result.can_deliver
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          result.can_deliver ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}>
                          {result.can_deliver
                            ? <FaCheck className="text-green-500" size={16} />
                            : <FaTimes className="text-red-500" size={16} />
                          }
                        </div>
                        <div>
                          <p className={`font-bold ${result.can_deliver ? 'text-green-500' : 'text-red-500'}`}>
                            {result.can_deliver ? '✅ Cobertura Disponible' : '❌ Sin Cobertura'}
                          </p>
                          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {result.location?.name} → {result.destination?.address || `${result.destination?.lat}, ${result.destination?.lng}`}
                          </p>
                        </div>
                        <div className="ml-auto text-right">
                          <div className="flex items-center gap-1.5 text-sm font-mono text-light-text-secondary dark:text-dark-text-secondary">
                            <FaRoute size={10} />
                            {result.distance_km} km
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Carrier results */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {result.carriers?.map((cr) => (
                        <div
                          key={cr.carrier_slug}
                          className={`rounded-xl p-4 border transition-all ${
                            cr.available
                              ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40'
                              : 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border-light-border/10 dark:border-dark-border/10'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <FaTruck size={14} className={cr.available ? 'text-green-500' : 'text-gray-400'} />
                            <span className="font-bold text-sm text-light-text-primary dark:text-dark-text-primary">
                              {cr.carrier_name}
                            </span>
                            <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              cr.available
                                ? 'bg-green-500/15 text-green-500'
                                : 'bg-red-500/15 text-red-500'
                            }`}>
                              {cr.available ? '✅ Disponible' : '❌ No cubre'}
                            </span>
                          </div>

                          {cr.available ? (
                            <div className="flex gap-4 mt-2">
                              {cr.fee != null && (
                                <div className="flex items-center gap-1.5 text-sm">
                                  <FaDollarSign size={10} className="text-green-500" />
                                  <span className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary">
                                    ${cr.fee?.toLocaleString('es-CL')}
                                  </span>
                                  <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">CLP</span>
                                </div>
                              )}
                              {cr.eta_min != null && (
                                <div className="flex items-center gap-1.5 text-sm">
                                  <FaClock size={10} className="text-cyan-500" />
                                  <span className="font-mono text-light-text-primary dark:text-dark-text-primary">
                                    {cr.eta_min} min
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-red-400/80 mt-1">
                              {cr.error || 'Fuera de zona de cobertura'}
                            </p>
                          )}

                          <div className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary mt-2">
                            Modo: {cr.mode}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CoverageTester;
