// Utilidades para controlar el aviso de newsletter por wallet
// Guarda el número de veces mostrado y el último rechazo por wallet (address) en cookies

const COOKIE_BASE = 'newsletter_prompt_';

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function setCookie(name, value, days) {
  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = `; expires=${date.toUTCString()}`;
  }
  document.cookie = `${name}=${value || ''}${expires}; path=/`;
}

export function getNewsletterPromptData(address) {
  if (!address) return { count: 0, lastReject: null };
  const raw = getCookie(COOKIE_BASE + address);
  if (!raw) return { count: 0, lastReject: null };
  try {
    const obj = JSON.parse(decodeURIComponent(raw));
    return { count: obj.count || 0, lastReject: obj.lastReject || null };
  } catch {
    return { count: 0, lastReject: null };
  }
}

export function setNewsletterPromptData(address, { count, lastReject }) {
  if (!address) return;
  const obj = { count, lastReject };
  setCookie(COOKIE_BASE + address, encodeURIComponent(JSON.stringify(obj)), 30);
}
