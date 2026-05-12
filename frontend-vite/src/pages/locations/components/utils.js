export function loadGoogleMapsScript(apiKey) {
  // Ya está cargado
  if (window.google && window.google.maps && window.google.maps.Map) return Promise.resolve();

  // Buscar script por id
  let script = document.getElementById('google-maps-script');
  if (script) {
    // Si ya está cargado, resuelve
    if (window.google && window.google.maps && window.google.maps.Map) return Promise.resolve();
    // Si aún no termina de cargar, espera el evento 'load'
    return new Promise((resolve, reject) => {
      script.addEventListener('load', resolve);
      script.addEventListener('error', reject);
    });
  }

  // Crear el script solo si no existe
  return new Promise((resolve, reject) => {
    script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (error) => reject(new Error(`Failed to load Google Maps API: ${error.message}`));
    document.body.appendChild(script);
  });
}

/**
 * Obtiene la dirección exacta usando Google Maps Geocoding API.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string>} Dirección legible
 */
export async function getAddressFromCoords(lat, lng) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=es`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.status === 'OK' && data.results.length > 0) {
    return data.results[0].formatted_address;
  }
  throw new Error('No se pudo obtener la dirección exacta');
}