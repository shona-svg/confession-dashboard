import { useState } from 'react';
import { format } from 'date-fns';
import type { FunnelStep, WeekBucket } from '../lib/metrics';
import { STAGE_LABEL } from '../lib/stages';
import { formatPercent } from '../lib/format';
import { StageNum } from './ui';

/** Horizontal bars for a single series, labelled directly. */
export function BarList({ rows, emptyText = 'Nothing in this period' }: {
  rows: { label: string; value: number; note?: string }[];
  emptyText?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (max === 0) return <p className="muted small">{emptyText}</p>;
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.label} title={`${r.label}: ${r.value}${r.note ? ` (${r.note})` : ''}`}>
          <span className="label">{r.label}</span>
          <div className="bar-track">
            {r.value > 0 && <div className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} />}
          </div>
          <span className="val">
            {r.value}
            {r.note && <span className="conv"> {r.note}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** How many enquiries reached each stage, with the step-to-step conversion. */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map((s) => s.count), 0);
  if (max === 0) return <p className="muted small">No enquiries in this period.</p>;
  return (
    <div className="bars funnel">
      {steps.map((s) => (
        <div
          className="bar-row"
          key={s.stage}
          title={`${STAGE_LABEL[s.stage]}: ${s.count}${s.fromPrevious != null ? `, ${formatPercent(s.fromPrevious)} of the previous step` : ''}`}
        >
          <StageNum stage={s.stage} />
          <span className="label">{STAGE_LABEL[s.stage]}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(s.count / max) * 100}%` }} />
          </div>
          <span className="val">
            {s.count}
            {s.fromPrevious != null && <span className="conv"> · {formatPercent(s.fromPrevious)}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const step = v <= 10 ? 2 : v <= 20 ? 5 : 10;
  return Math.ceil(v / step) * step;
}

/** Enquiries and tours booked per week, as paired columns. */
export function WeeklyChart({ weeks }: { weeks: WeekBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const W = 720;
  const H = 230;
  const pad = { l: 30, r: 8, t: 12, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const max = niceMax(Math.max(...weeks.map((w) => Math.max(w.enquiries, w.toursBooked)), 0));
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max].filter((v) => Number.isInteger(v));
  const slot = innerW / Math.max(weeks.length, 1);
  const barW = Math.max(3, Math.min(18, (slot - 8) / 2));
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;
  const labelEvery = Math.ceil(weeks.length / 8);

  // Column with a 4px rounded top, anchored flat on the baseline.
  const col = (x: number, v: number) => {
    if (v === 0) return '';
    const top = y(v);
    const h = pad.t + innerH - top;
    const r = Math.min(4, barW / 2, h);
    return `M${x},${pad.t + innerH}V${top + r}Q${x},${top} ${x + r},${top}H${x + barW - r}Q${x + barW},${top} ${x + barW},${top + r}V${pad.t + innerH}Z`;
  };

  const legend = (
    <div className="legend">
      <span>
        <i className="swatch" style={{ background: 'var(--chart-1)' }} /> Enquiries
      </span>
      <span>
        <i className="swatch" style={{ background: 'var(--chart-2)' }} /> Tours booked
      </span>
      <button type="button" className="link-btn small" onClick={() => setAsTable((v) => !v)}>
        {asTable ? 'Show chart' : 'Show as table'}
      </button>
    </div>
  );

  if (asTable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {legend}
        <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Week starting</th>
                <th className="r">Enquiries</th>
                <th className="r">Tours booked</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.start}>
                  <td>{format(w.start, 'd MMM yyyy')}</td>
                  <td className="r">{w.enquiries}</td>
                  <td className="r">{w.toursBooked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const hw = hover != null ? weeks[hover] : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {legend}
      <div className="chart-wrap">
        <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Enquiries and tours booked per week">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          {weeks.map((w, i) => {
            const x0 = pad.l + i * slot + (slot - (barW * 2 + 2)) / 2;
            return (
              <g key={w.start} opacity={hover == null || hover === i ? 1 : 0.45}>
                <path d={col(x0, w.enquiries)} fill="var(--chart-1)" />
                <path d={col(x0 + barW + 2, w.toursBooked)} fill="var(--chart-2)" />
                {i % labelEvery === 0 && (
                  <text x={pad.l + i * slot + slot / 2} y={H - 8} textAnchor="middle">
                    {format(w.start, 'd MMM')}
                  </text>
                )}
                <rect
                  x={pad.l + i * slot}
                  y={pad.t}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setHover(hover === i ? null : i)}
                />
              </g>
            );
          })}
          <line x1={pad.l} x2={W - pad.r} y1={pad.t + innerH} y2={pad.t + innerH} stroke="var(--line-strong)" />
        </svg>
        {hw && hover != null && (
          <div
            className="chart-tip"
            style={{
              left: `${((pad.l + hover * slot + slot / 2) / W) * 100}%`,
              top: `${(y(Math.max(hw.enquiries, hw.toursBooked)) / H) * 100}%`,
            }}
          >
            <strong>Week of {format(hw.start, 'd MMM')}</strong>
            <br />
            <i className="swatch" style={{ background: 'var(--chart-1)' }} /> {hw.enquiries} enquiries
            <br />
            <i className="swatch" style={{ background: 'var(--chart-2)' }} /> {hw.toursBooked} tours booked
          </div>
        )}
      </div>
    </div>
  );
}
