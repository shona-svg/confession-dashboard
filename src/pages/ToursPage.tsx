import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow } from 'date-fns';
import { useStore } from '../data/store';
import type { Tour } from '../data/types';
import { STAGE_LABEL } from '../lib/stages';
import { formatDate, formatTime, fullName } from '../lib/format';
import { Empty, OwnerDot, useToast } from '../components/ui';
import { BookTourModal } from '../components/modals';
import { PlusIcon } from '../components/Icons';

type Tab = 'upcoming' | 'outcome' | 'past';

export default function ToursPage() {
  const { data, insights, now, setTourStatus } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [booking, setBooking] = useState(false);

  const at = (t: Tour) => new Date(t.scheduledFor).getTime();
  const upcoming = data.tours.filter((t) => t.status === 'booked' && at(t) >= now).sort((a, b) => at(a) - at(b));
  const needsOutcome = data.tours.filter((t) => t.status === 'booked' && at(t) < now).sort((a, b) => at(a) - at(b));
  const past = data.tours.filter((t) => t.status !== 'booked').sort((a, b) => at(b) - at(a)).slice(0, 40);

  const list = tab === 'upcoming' ? upcoming : tab === 'outcome' ? needsOutcome : past;

  // Group by day.
  const groups: { day: string; label: string; tours: Tour[] }[] = [];
  for (const t of list) {
    const d = new Date(t.scheduledFor);
    const key = format(d, 'yyyy-MM-dd');
    let g = groups.find((x) => x.day === key);
    if (!g) {
      const label = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEEE');
      g = { day: key, label, tours: [] };
      groups.push(g);
    }
    g.tours.push(t);
  }

  const mark = (t: Tour, status: 'attended' | 'no_show' | 'cancelled') => {
    setTourStatus(t.id, status);
    const c = insights.get(t.contactId)?.contact;
    toast(`${c ? c.firstName : 'Tour'}: ${status === 'attended' ? 'attended' : status === 'no_show' ? 'no-show' : 'cancelled'}`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Venue tours · no pricing on the tour</div>
          <h1 className="page-title">Tours</h1>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setBooking(true)}>
            <PlusIcon size={16} /> Book a tour
          </button>
        </div>
      </div>

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

      <section className="card">
        {list.length === 0 ? (
          <Empty title={tab === 'outcome' ? 'Nothing to mark' : 'No tours here'}>
            {tab === 'outcome' ? 'Every past tour has an outcome.' : 'Book one from a contact or with the button above.'}
          </Empty>
        ) : (
          groups.map((g) => (
            <div key={g.day}>
              <div className="day-head">
                <span className="d">{g.label}</span>
                <span className="muted small">{formatDate(g.day, 'd MMMM yyyy')}</span>
                <span className="muted small" style={{ marginLeft: 'auto' }}>
                  {g.tours.length} {g.tours.length === 1 ? 'tour' : 'tours'}
                </span>
              </div>
              <div className="list">
                {g.tours.map((t) => {
                  const i = insights.get(t.contactId);
                  if (!i) return null;
                  const c = i.contact;
                  const ahead = Math.round((new Date(t.scheduledFor).getTime() - new Date(t.bookedAt).getTime()) / 86_400_000);
                  return (
                    <div className="list-row" key={t.id} style={{ flexWrap: 'wrap' }}>
                      <span className="time-chip">{formatTime(t.scheduledFor)}</span>
                      <div className="grow">
                        <Link className="title" to={`/contacts/${c.id}`}>
                          {fullName(c)}
                          {c.company ? ` · ${c.company}` : ''}
                        </Link>
                        <div className="meta">
                          {data.eventTypes.find((e) => e.id === c.eventTypeId)?.name ?? 'Event TBC'}
                          {c.guestCount ? ` · ${c.guestCount} guests` : ''} · {STAGE_LABEL[c.stage]} · booked{' '}
                          {formatDate(t.bookedAt, 'd MMM')} ({ahead} days ahead)
                          {t.notes ? ` · ${t.notes}` : ''}
                        </div>
                      </div>
                      <OwnerDot id={t.hostId} />
                      {t.status === 'booked' ? (
                        <span style={{ display: 'flex', gap: 6 }}>
                          <button className="btn small" onClick={() => mark(t, 'attended')}>
                            Attended
                          </button>
                          <button className="btn small" onClick={() => mark(t, 'no_show')}>
                            No-show
                          </button>
                          {tab === 'upcoming' && (
                            <button className="btn small ghost" onClick={() => mark(t, 'cancelled')}>
                              Cancel
                            </button>
                          )}
                        </span>
                      ) : (
                        <span className={`flag ${t.status === 'attended' ? 'good' : t.status === 'no_show' ? 'bad' : 'warn'}`}>
                          {t.status === 'attended' ? 'Attended' : t.status === 'no_show' ? 'No-show' : 'Cancelled'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {booking && <BookTourModal onClose={() => setBooking(false)} />}
    </div>
  );
}
