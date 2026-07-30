export const XP_THRESHOLD = 3000;

export function levelForXp(xp: number): number {
  return Math.floor(xp / XP_THRESHOLD) + 1;
}

export function xpInLevelForXp(xp: number): number {
  return xp % XP_THRESHOLD;
}
