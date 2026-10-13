export type SeasonKind = 'winterize' | 'dewinterize' | 'both';

// One job does one seasonal protocol. Ordinary service mentions neither.
export function seasonKind(text: string): SeasonKind | null {
  const value = text.toLowerCase();
  const winter = /konzervac|zimovan/.test(value);
  const spring = /dekonzerv|priprem\w* za sezon/.test(value);
  if (winter && spring) return 'both';
  if (winter) return 'winterize';
  if (spring) return 'dewinterize';
  return null;
}

export function isSpringTemplate(code: string) {
  return code.includes('dewinterize');
}

export function isWinterTemplate(code: string) {
  return code.includes('winterize') && !isSpringTemplate(code);
}
