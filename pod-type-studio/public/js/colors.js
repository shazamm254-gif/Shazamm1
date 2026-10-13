// Garment colors for the editor's shirt preview. Printify's catalog gives color
// NAMES only, so these hex values are approximate preview swatches — they never
// affect the exported PNG (which is transparent).
const KNOWN = {
  black: '#111111', white: '#ffffff', navy: '#1f2a44', 'heather navy': '#3b4256', 'athletic heather': '#b9b9b4',
  'dark grey heather': '#4a4a48', 'dark grey': '#4a4a48', 'deep heather': '#8a8a88', 'heather grey': '#a7a7a5', 'sport grey': '#a7a7a5',
  asphalt: '#4b4b4d', ash: '#e4e4e1', silver: '#c9c9c9', 'solid black blend': '#1a1a1a', 'black heather': '#2a2a2a',
  red: '#c8102e', 'canvas red': '#c8102e', cardinal: '#8a1c2b', maroon: '#5c1f2b', 'heather maroon': '#6b2d3a',
  'true royal': '#1d4f91', royal: '#1d4f91', 'heather true royal': '#3a65a8', 'steel blue': '#5f7c99', 'heather blue': '#6f8db5',
  'baby blue': '#a9c8e8', 'light blue': '#a9c8e8', 'heather columbia blue': '#87a9c9', 'ocean blue': '#2a6f97', teal: '#1b7a8c',
  kelly: '#128a4a', 'kelly green': '#128a4a', 'heather kelly': '#2f9a5e', forest: '#1f3b2c', 'heather forest': '#33493a',
  army: '#5b5b3f', 'heather olive': '#6e6d4c', olive: '#6b6b3a', military: '#4b5320', 'heather military green': '#5a614a', mint: '#a8e6cf',
  gold: '#f5b52a', 'heather mustard': '#d6a13a', mustard: '#d6a13a', yellow: '#f6e05e', 'heather yellow gold': '#e8b54a',
  orange: '#f26b21', 'heather orange': '#ef7d43', autumn: '#b5562a', rust: '#a2482a',
  pink: '#f4b6c2', 'soft pink': '#f7cdd3', 'heather mauve': '#b48a92', berry: '#9b2c5b', 'heather raspberry': '#c4476f',
  purple: '#4b2e83', 'team purple': '#4b2e83', 'heather team purple': '#5d4a8c', lavender: '#c5b5e0',
  brown: '#5a3e2b', 'heather brown': '#6c5442', tan: '#d2b48c', 'sand dune': '#d9c7a7', natural: '#efe6d2',
  'soft cream': '#f2e8d5', cream: '#f2e8d5', 'heather dust': '#e6d9c6', 'vintage white': '#f4f1ea', oatmeal: '#e2d8c3',
};

const DEFAULTS = ['Black', 'White', 'Navy', 'Heather Grey', 'Dark Grey Heather', 'Red', 'True Royal', 'Forest', 'Maroon', 'Natural', 'Army', 'Gold'];

export function colorHex(name) {
  const n = String(name).toLowerCase().trim();
  if (KNOWN[n]) return KNOWN[n];
  // Fall back on the closest keyword in the name ("Solid Navy Blend" -> navy).
  const key = Object.keys(KNOWN).sort((a, b) => b.length - a.length).find((k) => n.includes(k));
  return key ? KNOWN[key] : '#888888';
}

export function shirtSwatches(productColors) {
  const names = productColors?.length ? productColors : DEFAULTS;
  return names.map((name) => ({ name, hex: colorHex(name) }));
}
