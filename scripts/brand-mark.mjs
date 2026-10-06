// The Poslar mark, drawn from geometry: one continuous white line goes
// round the box, turns in at the top, draws the check as a band (two
// parallel edges, rounded short tip) and comes back out through the right
// side. A blue rounded square sits behind it, out to the line's outer edge,
// so the open top-right corner is blue right to the rim.
// Used by scripts/brand.mjs (logo files) and scripts/generate-icons.mjs.

export function poslarMark(o = {}) {
  const F0 = o.F0 ?? 12;
  const F1 = o.F1 ?? 88; // box (line centre)
  const R = o.R ?? 17; // box corner radius (line centre)
  const w = o.w ?? 8.8; // line width
  const ch = o.ch ?? 8; // channel inside the check band
  const Cx = o.Cx ?? 83; // where the top line turns in
  const Vy = o.Vy ?? 58; // band centre at the check's point
  const Ls = o.Ls ?? 20; // short arm length
  const D = ch + w; // distance between the band's two edge lines
  const r2 = Math.SQRT2;
  const h = D / 2;
  const Su = Cx + F0; // upper edge: x + y = Su
  const Sl = Su + D * r2; // lower edge
  const V = [Su + D / r2 - Vy, Vy];
  const Vi = [V[0], V[1] - D / r2];
  const Vo = [V[0], V[1] + D / r2];
  const Ts = [V[0] - Ls / r2, V[1] - Ls / r2];
  const T1 = [Ts[0] + h / r2, Ts[1] - h / r2];
  const T2 = [Ts[0] - h / r2, Ts[1] + h / r2];
  const B = [F1, Sl - F1];
  const f = (p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  const line = [
    `M ${f(B)}`,
    `L ${F1} ${F1 - R} A ${R} ${R} 0 0 1 ${F1 - R} ${F1}`,
    `L ${F0 + R} ${F1} A ${R} ${R} 0 0 1 ${F0} ${F1 - R}`,
    `L ${F0} ${F0 + R} A ${R} ${R} 0 0 1 ${F0 + R} ${F0}`,
    `L ${Cx} ${F0}`,
    `L ${f(Vi)}`,
    `L ${f(T1)}`,
    `A ${h} ${h} 0 0 0 ${f(T2)}`,
    `L ${f(Vo)}`,
    'Z',
  ].join(' ');
  const r = (v) => +v.toFixed(2);
  const e0 = r(F0 - w / 2);
  const e1 = r(F1 + w / 2);
  const box = { x: e0, y: e0, w: r(e1 - e0), h: r(e1 - e0), r: r(R + w / 2) };
  return { line, box, w, extent: [e0, e1] };
}

export const BLUE = '#1CA7DD';
export const ORANGE = '#F15A24';
export const WHITE = '#FAFAF8';

// The mark's shapes, in its own 0..100 units.
export function markShapes(m, fill = BLUE) {
  return `<rect x="${m.box.x}" y="${m.box.y}" width="${m.box.w}" height="${m.box.h}" rx="${m.box.r}" fill="${fill}"/><path d="${m.line}" fill="none" stroke="${WHITE}" stroke-width="${m.w}" stroke-linejoin="round" stroke-linecap="round"/>`;
}
