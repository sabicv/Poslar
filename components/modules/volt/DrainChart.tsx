// Current over time since locking, with the target line. Plain SVG: no
// chart library, renders on the server, prints on the report.
export function DrainChart({ readings, target }: { readings: { t: number; ma: number; event: string | null }[]; target: number }) {
  if (readings.length === 0) return <p className="text-sm text-muted">Još nema očitanja.</p>;
  const W = 600;
  const H = 180;
  const pad = { l: 44, r: 12, t: 12, b: 26 };
  const maxT = Math.max(10, ...readings.map((r) => r.t));
  const maxMa = Math.max(target * 2, ...readings.map((r) => r.ma)) * 1.1;
  const x = (t: number) => pad.l + (t / maxT) * (W - pad.l - pad.r);
  const y = (ma: number) => H - pad.b - (ma / maxMa) * (H - pad.t - pad.b);
  const line = readings.map((r, i) => `${i ? 'L' : 'M'}${x(r.t).toFixed(1)},${y(r.ma).toFixed(1)}`).join(' ');
  const last = readings[readings.length - 1];
  const ticks = [0, maxMa / 2, maxMa].map((v) => Math.round(v));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[420px]" role="img" aria-label="Graf parazitske potrošnje">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="stroke-line" strokeDasharray="2 4" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="fill-faint text-[10px]">
              {v}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} className="stroke-ok" strokeWidth={1.5} strokeDasharray="6 4" />
        <text x={W - pad.r} y={y(target) - 5} textAnchor="end" className="fill-ok text-[10px]">
          cilj {target} mA
        </text>
        <path d={line} fill="none" className="stroke-accent" strokeWidth={2.2} strokeLinejoin="round" />
        {readings.map((r, i) => (
          <g key={i}>
            <circle cx={x(r.t)} cy={y(r.ma)} r={3.2} className={r.ma > target ? 'fill-crit' : 'fill-ok'} />
            {r.event ? (
              // Near the edges the label leans inward, so it never covers the
              // scale on the left ("935" over "Zaključano") or runs off the right.
              <text
                x={x(r.t) + (x(r.t) < W * 0.18 ? 6 : x(r.t) > W * 0.82 ? -6 : 0)}
                y={y(r.ma) < pad.t + 16 ? y(r.ma) + 16 : y(r.ma) - 8}
                textAnchor={x(r.t) < W * 0.18 ? 'start' : x(r.t) > W * 0.82 ? 'end' : 'middle'}
                className="fill-muted text-[9px]"
              >
                {r.event.slice(0, 14)}
              </text>
            ) : null}
          </g>
        ))}
        <text x={pad.l} y={H - 6} className="fill-faint text-[10px]">
          0 min
        </text>
        <text x={W - pad.r} y={H - 6} textAnchor="end" className="fill-faint text-[10px]">
          {maxT} min
        </text>
      </svg>
      <p className="mt-1 text-xs text-muted">
        Zadnje: <b className={last.ma > target ? 'text-crit' : 'text-ok'}>{last.ma} mA</b> nakon {last.t} min
      </p>
    </div>
  );
}
