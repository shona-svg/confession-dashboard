import { useState } from 'react';
import { format, isSameDay, isToday, isTomorrow, startOfMonth } from 'date-fns';
import { useStore } from '../data/store';
import type { Contact, Tour, VenueEvent } from '../data/types';
import { formatDate, fullName } from '../lib/format';
import { Empty, useToast } from '../components/ui';
import { ContactFormModal } from '../components/modals';
import { RescheduleModal, TourCard } from '../components/tours';
import {
  BookingDetailModal,
  ConfirmModal,
  EditEventModal,
  EventCard,
  NewBookingModal,
  toYmd,
  type BookingRef,
} from '../components/bookings';
import { BookingCalendar, type CalendarFilters } from '../components/BookingCalendar';
import { PlusIcon } from '../components/Icons';

type View = 'calendar' | 'list';
type Tab = 'tours' | 'events' | 'outcome' | 'past';

function readPref<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    // ignore
  }
}

function dayLabel(d: Date) {
  return isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEEE');
}

export default function BookingsPage() {
  const { data, insights, now, updateEvent } = useStore();
  const toast = useToast();
  const [view, setView] = useState<View>(() => readPref('confession-bookings-view', ['calendar', 'list'], 'calendar'));
  const [tab, setTab] = useState<Tab>('tours');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
  const [filters, setFilters] = useState<CalendarFilters>({ tours: true, events: true, requested: false });

  // Windows that can be open on this page.
  const [newBooking, setNewBooking] = useState<{ date?: Date; kind: 'tour' | 'event' } | null>(null);
  const [detail, setDetail] = useState<BookingRef | null>(null);
  const [editClient, setEditClient] = useState<Contact | null>(null);
  const [moving, setMoving] = useState<Tour | null>(null);
  const [editingEvent, setEditingEvent] = useState<VenueEvent | null>(null);
  const [clash, setClash] = useState<{ ev: VenueEvent; date: string; other: VenueEvent } | null>(null);

  const pickView = (v: View) => {
    setView(v);
    writePref('confession-bookings-view', v);
  };

  const at = (t: Tour) => new Date(t.scheduledFor).getTime();
  const today = toYmd(new Date(now));
  const upcomingTours = data.tours.filter((t) => t.status === 'booked' && at(t) >= now).sort((a, b) => at(a) - at(b));
  const needsOutcome = data.tours.filter((t) => t.status === 'booked' && at(t) < now).sort((a, b) => at(a) - at(b));
  const upcomingEvents = data.events
    .filter((e) => e.status !== 'cancelled' && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const pastTours = data.tours.filter((t) => t.status !== 'booked').map((t) => ({ when: t.scheduledFor, tour: t }));
  const pastEvents = data.events
    .filter((e) => e.date < today || e.status === 'cancelled')
    .map((e) => ({ when: `${e.date}T${e.startTime}`, event: e }));
  const past = [...pastTours, ...pastEvents].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 40);

  const dayTours = data.tours.filter((t) => isSameDay(new Date(t.scheduledFor), selected)).sort((a, b) => at(a) - at(b));
  const dayEvents = data.events.filter((e) => e.date === toYmd(selected));

  const tourCards = (list: Tour[], showDate = false) =>
    list.map((t) => <TourCard key={t.id} tour={t} onReschedule={setMoving} showDate={showDate} />);
  const eventCards = (list: VenueEvent[], showDate = true) =>
    list.map((e) => <EventCard key={e.id} event={e} onEdit={setEditingEvent} showDate={showDate} />);

  const nameOf = (id: string) => {
    const c = insights.get(id)?.contact;
    return c ? fullName(c) : 'another client';
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Venue tours and events · one event at a time</div>
          <h1 className="page-title">Bookings</h1>
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
          <button className="btn" onClick={() => setNewBooking({ kind: 'event' })}>
            <PlusIcon size={16} /> Book an event
          </button>
          <button className="btn primary" onClick={() => setNewBooking({ kind: 'tour' })}>
            <PlusIcon size={16} /> Book a tour
          </button>
        </div>
      </div>

      {needsOutcome.length > 0 && (
        <section className="card attention-card">
          <div className="card-head">
            <h2 className="card-title">Tours needing an outcome</h2>
            <span className="card-note">These have happened. Mark each one attended or no-show</span>
          </div>
          <div className="card-grid">{tourCards(needsOutcome, true)}</div>
        </section>
      )}

      {view === 'calendar' ? (
        <>
          <section className="card">
            <div className="filters" style={{ marginBottom: 14 }}>
              {(
                [
                  ['tours', 'Tours'],
                  ['events', 'Events'],
                  ['requested', 'Dates leads have asked for'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="small check">
                  <input
                    id={`cal-f-${k}`}
                    type="checkbox"
                    checked={filters[k]}
                    onChange={(e) => setFilters((f) => ({ ...f, [k]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
            <BookingCalendar
              month={month}
              onMonth={setMonth}
              selected={selected}
              onSelect={setSelected}
              filters={filters}
              onOpen={setDetail}
              onBook={(d) => setNewBooking({ date: d, kind: 'tour' })}
              onEventClash={(ev, date, other) => setClash({ ev, date, other })}
            />
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">
                {dayLabel(selected)} · {formatDate(selected.getTime(), 'd MMMM')}
              </h2>
              {toYmd(selected) >= today && (
                <div className="page-actions">
                  <button className="btn small" onClick={() => setNewBooking({ date: selected, kind: 'tour' })}>
                    + Tour
                  </button>
                  <button className="btn small" onClick={() => setNewBooking({ date: selected, kind: 'event' })}>
                    + Event
                  </button>
                </div>
              )}
            </div>
            {dayTours.length + dayEvents.length === 0 ? (
              <Empty title="Nothing booked">Click an empty spot on the calendar, or use the buttons above.</Empty>
            ) : (
              <div className="card-grid">
                {eventCards(dayEvents, false)}
                {tourCards(dayTours)}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="card">
          <div className="card-head">
            <div className="segmented" role="group" aria-label="Which bookings">
              <button aria-pressed={tab === 'tours'} onClick={() => setTab('tours')}>
                Upcoming tours ({upcomingTours.length})
              </button>
              <button aria-pressed={tab === 'events'} onClick={() => setTab('events')}>
                Upcoming events ({upcomingEvents.length})
              </button>
              <button aria-pressed={tab === 'outcome'} onClick={() => setTab('outcome')}>
                Needs outcome ({needsOutcome.length})
              </button>
              <button aria-pressed={tab === 'past'} onClick={() => setTab('past')}>
                Past
              </button>
            </div>
          </div>
          {tab === 'tours' &&
            (upcomingTours.length ? <DayGroups items={upcomingTours.map((t) => ({ when: t.scheduledFor, node: tourCards([t])[0] }))} /> : <Empty title="No tours booked" />)}
          {tab === 'events' && (upcomingEvents.length ? <div className="card-grid">{eventCards(upcomingEvents)}</div> : <Empty title="No events booked" />)}
          {tab === 'outcome' && (needsOutcome.length ? <div className="card-grid">{tourCards(needsOutcome, true)}</div> : <Empty title="Nothing to mark" />)}
          {tab === 'past' &&
            (past.length ? (
              <div className="card-grid">
                {past.map((p) =>
                  'tour' in p ? tourCards([p.tour], true)[0] : eventCards([p.event])[0],
                )}
              </div>
            ) : (
              <Empty title="Nothing yet" />
            ))}
        </section>
      )}

      {newBooking && <NewBookingModal initialDate={newBooking.date} initialKind={newBooking.kind} onClose={() => setNewBooking(null)} />}
      {detail && (
        <BookingDetailModal
          booking={detail}
          onClose={() => setDetail(null)}
          onEditClient={setEditClient}
          onReschedule={setMoving}
          onEditEvent={setEditingEvent}
        />
      )}
      {editClient && <ContactFormModal contact={editClient} onClose={() => setEditClient(null)} />}
      {moving && <RescheduleModal tour={moving} onClose={() => setMoving(null)} />}
      {editingEvent && <EditEventModal event={editingEvent} onClose={() => setEditingEvent(null)} />}
      {clash && (
        <ConfirmModal
          title="That date is taken"
          confirmLabel="Move anyway"
          onClose={() => setClash(null)}
          onConfirm={() => {
            updateEvent(clash.ev.id, { date: clash.date });
            toast('Event moved. It shows as a clash until one of them changes');
          }}
        >
          <p style={{ margin: 0 }}>
            {formatDate(clash.date)} already has {nameOf(clash.other.contactId)}'s event (
            {clash.other.status === 'hold' ? 'on hold' : 'confirmed'}). The venue runs one event at a time.
          </p>
        </ConfirmModal>
      )}
    </div>
  );
}

function DayGroups({ items }: { items: { when: string; node: React.ReactNode }[] }) {
  const groups: { key: string; date: Date; nodes: React.ReactNode[] }[] = [];
  for (const it of items) {
    const d = new Date(it.when);
    const key = format(d, 'yyyy-MM-dd');
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, date: d, nodes: [] }));
    g.nodes.push(it.node);
  }
  return (
    <>
      {groups.map((g) => (
        <div key={g.key} className="day-group">
          <div className="day-head">
            <span className="d">{dayLabel(g.date)}</span>
            <span className="muted small">{format(g.date, 'd MMMM yyyy')}</span>
          </div>
          <div className="card-grid">{g.nodes}</div>
        </div>
      ))}
    </>
  );
}
