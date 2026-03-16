export const AVATARS = [
  {
    id: 'positive-stability',
    title: 'Positive Stability',
    src: './assets/avatars/positive-stability.svg',
    short: 'Top Pole',
  },
  {
    id: 'negative-stability',
    title: 'Negative Stability',
    src: './assets/avatars/negative-stability.svg',
    short: 'Lower Pole',
  },
  {
    id: 'empathy',
    title: 'Empathy',
    src: './assets/avatars/empathy.svg',
    short: 'Positive X',
  },
  {
    id: 'practicality',
    title: 'Practicality',
    src: './assets/avatars/practicality.svg',
    short: 'Negative X',
  },
  {
    id: 'wisdom',
    title: 'Wisdom',
    src: './assets/avatars/wisdom.svg',
    short: 'Positive Z',
  },
  {
    id: 'knowledge',
    title: 'Knowledge',
    src: './assets/avatars/knowledge.svg',
    short: 'Negative Z',
  },
  {
    id: 'empathy-wisdom',
    title: 'Empathy + Wisdom',
    src: './assets/avatars/empathy-wisdom.svg',
    short: 'Upper Equator',
  },
  {
    id: 'empathy-knowledge',
    title: 'Empathy + Knowledge',
    src: './assets/avatars/empathy-knowledge.svg',
    short: 'Front Equator',
  },
  {
    id: 'practicality-wisdom',
    title: 'Practicality + Wisdom',
    src: './assets/avatars/practicality-wisdom.svg',
    short: 'Rear Equator',
  },
  {
    id: 'practicality-knowledge',
    title: 'Practicality + Knowledge',
    src: './assets/avatars/practicality-knowledge.svg',
    short: 'Lower Equator',
  },
];

export function getAvatarById(id) {
  return AVATARS.find((avatar) => avatar.id === id) || null;
}

export function pickAvatarFromPoint(point) {
  const { x = 0, y = 0, z = 0 } = point || {};
  const ay = Math.abs(y);

  if (ay >= 0.68) {
    return y >= 0 ? getAvatarById('positive-stability') : getAvatarById('negative-stability');
  }

  const hasX = Math.abs(x) >= 0.18;
  const hasZ = Math.abs(z) >= 0.18;

  if (hasX && hasZ) {
    if (x >= 0 && z >= 0) return getAvatarById('empathy-wisdom');
    if (x >= 0 && z < 0) return getAvatarById('empathy-knowledge');
    if (x < 0 && z >= 0) return getAvatarById('practicality-wisdom');
    return getAvatarById('practicality-knowledge');
  }

  if (Math.abs(x) >= Math.abs(z)) {
    return x >= 0 ? getAvatarById('empathy') : getAvatarById('practicality');
  }

  return z >= 0 ? getAvatarById('wisdom') : getAvatarById('knowledge');
}
