// Chilean RUT utilities: clean, format, validate, and extract number part for backend
// UI format used: digits + '-' + DV (no dots), e.g., 18766647-3

// Remove all characters except 0-9 and K/k
export function cleanRut(value = '') {
  return String(value).replace(/[^0-9kK]/g, '').toUpperCase();
}

// Split into number part and DV (last char), given a cleaned RUT
export function splitRut(cleaned) {
  if (!cleaned) return { num: '', dv: '' };
  if (cleaned.length === 1) return { num: '', dv: cleaned };
  const dv = cleaned.slice(-1);
  const num = cleaned.slice(0, -1);
  return { num, dv };
}

// Compute DV using modulo 11 algorithm
export function computeDv(numStr) {
  if (!numStr) return '';
  let sum = 0;
  let mul = 2;
  for (let i = numStr.length - 1; i >= 0; i--) {
    sum += parseInt(numStr[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1; // cycle 2..7
  }
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

// Validate full RUT string (may contain separators)
export function isValidRut(value) {
  const cleaned = cleanRut(value);
  const { num, dv } = splitRut(cleaned);
  if (!num || !dv) return false;
  return computeDv(num) === dv;
}

// Format for UI: always num + '-' + DV (if any DV), no dots
export function formatRutUI(value) {
  const cleaned = cleanRut(value);
  const { num, dv } = splitRut(cleaned);
  if (!num && !dv) return '';
  if (!dv) return num; // typing initial digits, no hyphen yet
  return `${num}-${dv}`;
}

// For backend: only the numeric part (no DV)
export function toBackendRut(value) {
  const cleaned = cleanRut(value);
  const { num } = splitRut(cleaned);
  return num;
}
