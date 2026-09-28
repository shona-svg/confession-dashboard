import { useState } from 'react';
import { format, isSameDay, isToday, isTomorrow, startOfMonth } from 'date-fns';
import { useStore } from '../data/store';
import type { Tour } from '../data/types';
import { formatDate } from '../lib/format';
import { Empty } from '../components/ui';
import { BookTourModal } from '../components/modals';
import { RescheduleModal, TourCalendar, TourCard } from '../components/tours';
import { PlusIcon } from '../components/Icons';

type View = 'calendar' | 'list';
type Tab = 'upcoming' | 'outcome' | 'past';

function readView(): View {
  try {
    return localStorage.getItem('confession-tours-view') === 'list' ? 'list' : 'calendar';
  } catch {
    return 'calendar';
  }
}

function dayLabel(d: Date) {
  return isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEEE');
}

export default function ToursPage() {
  const { data, now } = useStore();
  const [view, setView] = useState<View>(readView);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
  const [booking, setBooking] = useState(false);
  const [moving, setMoving] = useState<Tour | null>(null);

  const pickView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem('confession-tours-view', v);
    } catch {
      // ignore
    }
  };

  const at = (t: Tour) => new Date(t.scheduledFor).getTime();
  const upcoming = data.tours.filter((t) => t.status === 'booked' && at(t) >= now).sort((a, b) => at(a) - at(b));
  const needsOutcome = data.tours.filter((t) => t.status === 'booked' && at(t) < now).sort((a, b) => at(a) - at(b));
  const past = data.tours.filter((t) => t.status !== 'booked').sort((a, b) => at(b) - at(a)).slice(0, 40);
  const onDay = data.tours.filter((t) => isSameDay(new Date(t.scheduledFor), selected)).sort((a, b) => at(a) - at(b));

  const grouped = (list: Tour[]) => {
    const groups: { key: string; date: Date; tours: Tour[] }[] = [];
    for (const t of list) {
      const d = new Date(t.scheduledFor);
      const key = format(d, 'yyyy-MM-dd');
      let g = groups.find((x) => x.key === key);
      if (!g) groups.push((g = { key, date: d, tours: [] }));
      g.tours.push(t);
    }
    return groups;
  };

  const cards = (list: Tour[], showDate = false) => (
    <div className="card-grid">
      {list.map((t) => (
        <TourCard key={t.id} tour={t} onReschedule={setMoving} showDate={showDate} />
      ))}
    </div>
  );

  const listTours = tab === 'upcoming' ? upcoming : tab === 'outcome' ? needsOutcome : past;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Venue tours · no pricing on the tour</div>
          <h1 className="page-title">Tours</h1>
        </div>
        <div className="page-actions">
          <div className="segmented" role="group" aria-label="View">
            <button aria-pressed={view === 'calendar'} onClick={() => pickView('calendar')}>
              Calendar
            </button>
            <button aria-pressed={view === 'list'} onClick={() => pickView('list')}>
              List
            </button>
          </div>
          <button className="btn primary" onClick={() => setBooking(true)}>
            <PlusIcon size={16} /> Book a tour
          </button>
        </div>
      </div>

      {needsOutcome.length > 0 && (
        <section className="card attention-card">
          <div className="card-head">
            <h2 className="card-title">Needs an outcome</h2>
            <span className="card-note">These tours have happened. Mark each one attended or no-show</span>
          </div>
          {cards(needsOutcome, true)}
        </section>
      )}

      {view === 'calendar' ? (
        <>
          <section className="card">
            <TourCalendar
              tours={data.tours}
              month={month}
              onMonth={setMonth}
              selected={selected}
              onSelect={(d) => {
                setSelected(d);
                if (d.getMonth() !== month.getMonth()) setMonth(startOfMonth(d));
              }}
            />
          </section>
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">
                {dayLabel(selected)} · {formatDate(selected.getTime(), 'd MMMM')}
              </h2>
              <span className="card-note">
                {onDay.length} {onDay.length === 1 ? 'tour' : 'tours'}
              </span>
            </div>
            {onDay.length === 0 ? <Empty title="No tours this day">Pick another day, or book one.</Empty> : cards(onDay)}
          </section>
        </>
      ) : (
        <section className="card">
          <div className="card-head">
            <div className="segmented" role="group" aria-label="Which tours">
              <button aria-pressed={tab === 'upcoming'} onClick={() => setTab('upcoming')}>
                Upcoming ({upcoming.length})
              </button>
              <button aria-pressed={tab === 'outcome'} onClick={() => setTab('outcome')}>
                Needs outcome ({needsOutcome.length})
              </button>
              <button aria-pressed={tab === 'past'} onClick={() => setTab('past')}>
                Past
              </button>
            </div>
          </div>
          {listTours.length === 0 ? (
            <Empty title="No tours here">Book one from a contact or with the button above.</Empty>
          ) : (
            grouped(listTours).map((g) => (
              <div key={g.key} className="day-group">
                <div className="day-head">
                  <span className="d">{dayLabel(g.date)}</span>
                  <span className="muted small">{format(g.date, 'd MMMM yyyy')}</span>
                  <span className="muted small" style={{ marginLeft: 'auto' }}>
                    {g.tours.length} {g.tours.length === 1 ? 'tour' : 'tours'}
                  </span>
                </div>
                {cards(g.tours)}
              </div>
            ))
          )}
        </section>
      )}

      {booking && <BookTourModal onClose={() => setBooking(false)} />}
      {moving && <RescheduleModal tour={moving} onClose={() => setMoving(null)} />}
    </div>
  );
}
