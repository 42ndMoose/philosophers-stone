export const AVATARS = [
  {
    id: 'steady',
    title: 'Steady',
    src: './assets/avatars/steady.svg',
    short: 'Top Pole',
  },
  {
    id: 'feral',
    title: 'Feral',
    src: './assets/avatars/feral.svg',
    short: 'Lower Pole',
  },
  {
    id: 'kind',
    title: 'Kind',
    src: './assets/avatars/kind.svg',
    short: 'Positive X',
  },
  {
    id: 'gritty',
    title: 'Gritty',
    src: './assets/avatars/gritty.svg',
    short: 'Negative X',
  },
  {
    id: 'sage',
    title: 'Sage',
    src: './assets/avatars/sage.svg',
    short: 'Positive Z',
  },
  {
    id: 'geeky',
    title: 'Geeky',
    src: './assets/avatars/geeky.svg',
    short: 'Negative Z',
  },
  {
    id: 'radiant',
    title: 'Radiant',
    src: './assets/avatars/radiant.svg',
    short: 'Upper Equator',
  },
  {
    id: 'quirky',
    title: 'Quirky',
    src: './assets/avatars/quirky.svg',
    short: 'Front Equator',
  },
  {
    id: 'shrewd',
    title: 'Shrewd',
    src: './assets/avatars/shrewd.svg',
    short: 'Rear Equator',
  },
  {
    id: 'rogue',
    title: 'Rogue',
    src: './assets/avatars/rogue.svg',
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
    return y >= 0 ? getAvatarById('steady') : getAvatarById('feral');
  }

  const hasX = Math.abs(x) >= 0.18;
  const hasZ = Math.abs(z) >= 0.18;

  if (hasX && hasZ) {
    if (x >= 0 && z >= 0) return getAvatarById('radiant');
    if (x >= 0 && z < 0) return getAvatarById('quirky');
    if (x < 0 && z >= 0) return getAvatarById('shrewd');
    return getAvatarById('rogue');
  }

  if (Math.abs(x) >= Math.abs(z)) {
    return x >= 0 ? getAvatarById('kind') : getAvatarById('gritty');
  }

  return z >= 0 ? getAvatarById('sage') : getAvatarById('geeky');
}
