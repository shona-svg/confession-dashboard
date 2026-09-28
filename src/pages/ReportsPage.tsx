import { useState } from 'react';
import { useStore } from '../data/store';
import {
  byAudience,
  byEventType,
  bySource,
  funnel,
  lostReasons,
  RANGES,
  rangeFor,
  speed,
  tourStats,
  weekdayWeekend,
  weekly,
  type RangeKey,
  type SegmentRow,
} from '../lib/metrics';
import { formatDays, formatHours, formatMoney, formatPercent } from '../lib/format';
import { BarList, Funnel, WeeklyChart } from '../components/charts';
import { RULES } from '../lib/stages';

function readRange(): RangeKey {
  try {
    const v = localStorage.getItem('confession-report-range');
    if (v === '30d' || v === '90d' || v === '6m' || v === 'all') return v;
  } catch {
    // ignore
  }
  return '90d';
}

export default function ReportsPage() {
  const { data, insights, now } = useStore();
  const [key, setKey] = useState<RangeKey>(readRange);
  const pick = (k: RangeKey) => {
    setKey(k);
    try {
      localStorage.setItem('confession-report-range', k);
    } catch {
      // ignore
    }
  };
  const r = rangeFor(key, now);
  const f = funnel(insights, r);
  const weeks = weekly(data, insights, r, now);
  const sources = bySource(insights, r);
  const types = byEventType(data, insights, r);
  const audiences = byAudience(insights, r);
  const sp = speed(insights, r);
  const tours = tourStats(data, insights, r, now);
  const lost = lostReasons(insights, r);
  const days = weekdayWeekend(insights, r);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Based on enquiries that arrived in the period</div>
          <h1 className="page-title">Reports</h1>
        </div>
        <div className="segmented" role="group" aria-label="Date range">
          {RANGES.map((x) => (
            <button key={x.id} aria-pressed={key === x.id} onClick={() => pick(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Funnel</h2>
            <span className="card-note">
              {f.cohortSize} enquiries · {f.lost} lost · % = moved on from the step before
            </span>
          </div>
          <Funnel steps={f.steps} />
          <p className="small muted" style={{ marginBottom: 0 }}>
            Prospects: {f.prospects} new in this period, {f.prospectsConverted} went on to enquire (
            {formatPercent(f.prospects ? f.prospectsConverted / f.prospects : null)}). Anyone who skipped a stage still
            counts as having passed through it.
          </p>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Enquiries &amp; tours per week</h2>
          </div>
          <WeeklyChart weeks={weeks} />
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Speed</h2>
          <span className="card-note">Averages across enquiries in the period</span>
        </div>
        <div className="stat-row">
          <div className="stat">
            <span className="l">First reply</span>
            <span className="v">{formatHours(sp.firstReplyHours)}</span>
            <span className="s">
              {formatPercent(sp.repliedWithin24)} within {RULES.replyWithinHours}h · target same business day
            </span>
          </div>
          <div className="stat">
            <span className="l">Enquiry to tour</span>
            <span className="v">{formatDays(sp.enquiryToTourDays)}</span>
            <span className="s">From enquiry to the tour itself</span>
          </div>
          <div className="stat">
            <span className="l">Tour booking to tour date</span>
            <span className="v">{formatDays(tours.bookingToTourDays)}</span>
            <span className="s">How far ahead tours are booked</span>
          </div>
          <div className="stat">
            <span className="l">Tour to proposal</span>
            <span className="v">{formatHours(sp.tourToProposalHours)}</span>
            <span className="s">
              {formatPercent(sp.proposalWithin48)} within {RULES.proposalWithinHours}h · target 24–48h
            </span>
          </div>
          <div className="stat">
            <span className="l">Tour to confirmed</span>
            <span className="v">{formatDays(sp.tourToConfirmedDays)}</span>
            <span className="s">From the tour to deposit paid</span>
          </div>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Tours</h2>
            <span className="card-note">Tours that took place in the period</span>
          </div>
          <div className="stat-row">
            <div className="stat">
              <span className="l">Booked</span>
              <span className="v">{tours.booked}</span>
              <span className="s">Tours booked in the period</span>
            </div>
            <div className="stat">
              <span className="l">Attended</span>
              <span className="v">{tours.attended}</span>
              <span className="s">{tours.unmarked ? `${tours.unmarked} still need an outcome` : 'All outcomes recorded'}</span>
            </div>
            <div className="stat">
              <span className="l">No-show rate</span>
              <span className="v">{formatPercent(tours.noShowRate)}</span>
              <span className="s">{tours.noShow} no-shows · {tours.cancelled} cancelled</span>
            </div>
            <div className="stat">
              <span className="l">Tour to booking</span>
              <span className="v">{formatPercent(tours.tourToBooking)}</span>
              <span className="s">Attended tours that went on to confirm</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Lost reasons</h2>
            <span className="card-note">{lost.total} lost in the period</span>
          </div>
          <BarList
            rows={lost.rows.map((x) => ({
              label: x.label,
              value: x.count,
              note: lost.total ? formatPercent(x.count / lost.total) : undefined,
            }))}
            emptyText="Nobody lost in this period."
          />
        </section>
      </div>

      <SegmentTable title="By source" rows={sources} firstCol="Source" showNew />
      <SegmentTable title="By event type" rows={types} firstCol="Event type" showGuests showPipeline />
      <SegmentTable
        title="By audience"
        rows={audiences}
        firstCol="Audience"
        showGuests
        showPipeline
        note={`Confirmed event dates: ${days.weekend} on a weekend (Fri to Sun), ${days.weekday} midweek`}
      />
    </div>
  );
}

function SegmentTable({
  title,
  rows,
  firstCol,
  showNew,
  showGuests,
  showPipeline,
  note,
}: {
  title: string;
  rows: SegmentRow[];
  firstCol: string;
  showNew?: boolean;
  showGuests?: boolean;
  showPipeline?: boolean;
  note?: string;
}) {
  const total = rows.reduce(
    (a, r) => ({
      newContacts: a.newContacts + r.newContacts,
      enquiries: a.enquiries + r.enquiries,
      tours: a.tours + r.tours,
      confirmed: a.confirmed + r.confirmed,
      confirmedValue: a.confirmedValue + r.confirmedValue,
      pipelineValue: a.pipelineValue + r.pipelineValue,
    }),
    { newContacts: 0, enquiries: 0, tours: 0, confirmed: 0, confirmedValue: 0, pipelineValue: 0 },
  );
  const shown = rows.filter((r) => r.enquiries || r.newContacts);
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">{title}</h2>
        {note && <span className="card-note">{note}</span>}
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>{firstCol}</th>
              {showNew && <th className="r">New contacts</th>}
              <th className="r">Enquiries</th>
              <th className="r">Tours</th>
              <th className="r">Confirmed</th>
              <th className="r">Conversion</th>
              {showGuests && <th className="r">Avg guests</th>}
              {showPipeline && <th className="r">Open pipeline</th>}
              <th className="r">Confirmed value</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                {showNew && <td className="r">{r.newContacts}</td>}
                <td className="r">{r.enquiries}</td>
                <td className="r">{r.tours}</td>
                <td className="r">{r.confirmed}</td>
                <td className="r">{formatPercent(r.conversion)}</td>
                {showGuests && <td className="r">{r.avgGuests ?? '—'}</td>}
                {showPipeline && <td className="r">{formatMoney(r.pipelineValue)}</td>}
                <td className="r">{formatMoney(r.confirmedValue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              {showNew && <td className="r">{total.newContacts}</td>}
              <td className="r">{total.enquiries}</td>
              <td className="r">{total.tours}</td>
              <td className="r">{total.confirmed}</td>
              <td className="r">{formatPercent(total.enquiries ? total.confirmed / total.enquiries : null)}</td>
              {showGuests && <td className="r" />}
              {showPipeline && <td className="r">{formatMoney(total.pipelineValue)}</td>}
              <td className="r">{formatMoney(total.confirmedValue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>
        Tours and confirmed count enquiries from this period that have reached that stage so far. Conversion =
        confirmed ÷ enquiries.
      </p>
    </section>
  );
}
