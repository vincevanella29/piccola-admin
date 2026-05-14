// Centralized section → color mapping for community chat
// Used in MembersPanel (member names) and ChannelView (message usernames)

export const SECTION_COLORS = {
  cocina:   { color: '#f97316', bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-400', border: 'border-orange-500/20' },
  sala:     { color: '#3b82f6', bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400', border: 'border-blue-500/20' },
  delivery: { color: '#22c55e', bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-400', border: 'border-green-500/20' },
  general:  { color: '#a855f7', bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400', border: 'border-purple-500/20' },
  admin:    { color: '#ef4444', bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400', border: 'border-red-500/20' },
  bar:      { color: '#06b6d4', bg: 'bg-cyan-500/10', text: 'text-cyan-400', dot: 'bg-cyan-400', border: 'border-cyan-500/20' },
  caja:     { color: '#eab308', bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-400', border: 'border-yellow-500/20' },
};

const strToHsl = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  // Use vibrant but readable colors (70% saturation, 60% lightness)
  return `hsl(${h}, 70%, 60%)`;
};

// If we add admin overrides, we can inject them here
let colorOverrides = {};
export const setSectionColorOverrides = (overrides) => { colorOverrides = overrides; };

export const getSectionColor = (seccion) => {
  const s = (seccion || '').toLowerCase().trim();
  if (colorOverrides[s]) return { color: colorOverrides[s], isDynamic: true };
  if (SECTION_COLORS[s]) return SECTION_COLORS[s];
  
  // Dynamically generate a distinct color
  return { color: strToHsl(s), isDynamic: true };
};

export const SECTION_ICONS = {
  cocina: '🍳', delivery: '🍕', sala: '🍽️', general: '💬',
  admin: '👑', bar: '🍸', caja: '💰', default: '🏷️',
};

export const getSectionIcon = (seccion) =>
  SECTION_ICONS[(seccion || '').toLowerCase().trim()] || SECTION_ICONS.default;
