export function loadGoogleMapsScript(apiKey) {
  // Ya está cargado
  if (window.google && window.google.maps && window.google.maps.Map) return Promise.resolve();

  // Buscar script por id
  let script = document.getElementById('google-maps-script');
  if (script) {
    if (window.google && window.google.maps && window.google.maps.Map) return Promise.resolve();
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.Map) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  // Crear el script solo si no existe
  return new Promise((resolve, reject) => {
    window.__initGoogleMaps = () => {
      resolve();
    };
    script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&libraries=visualization,places,marker&callback=__initGoogleMaps`;
    script.async = true;
    script.defer = true;
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