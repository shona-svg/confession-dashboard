// Events at the venue, and the pieces the Bookings calendar shares between
// tours and events.
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useStore, type EventInput } from '../data/store';
import type { Contact, Dataset, EventStatus, Space, Tour, VenueEvent } from '../data/types';
import { RULES, SOURCE_LABEL, SPACE_LABEL, STAGE_LABEL } from '../lib/stages';
import { formatDate, formatMoney, fullName } from '../lib/format';
import { Modal, OwnerDot, StatusTag, useToast } from './ui';
import { TourForm } from './modals';
import { TourCard } from './tours';
import { EmailButton, EmailLink } from './EmailComposer';

export const toYmd = (d: Date) => format(d, 'yyyy-MM-dd');

/** Another live event (held or confirmed) on the same date. The venue runs one event at a time. */
export function clashFor(data: Dataset, date: string, excludeId?: string): VenueEvent | undefined {
  return data.events.find((e) => e.date === date && e.id !== excludeId && e.status !== 'cancelled');
}

function time12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return format(d, m ? 'h:mmaaa' : 'haaa');
}

export function eventTimes(ev: Pick<VenueEvent, 'startTime' | 'endTime'>) {
  return `${time12(ev.startTime)}–${time12(ev.endTime)}`;
}

// ---------- Event form ----------

export function EventForm({
  contact,
  event,
  initialDate,
  onDone,
  onCancel,
}: {
  contact?: Contact;
  event?: VenueEvent;
  initialDate?: Date;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { data, bookEvent, updateEvent } = useStore();
  const toast = useToast();
  const candidates = data.contacts
    .filter((c) => c.stage !== 'prospect')
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const [contactId, setContactId] = useState(event?.contactId ?? contact?.id ?? '');
  const picked = data.contacts.find((c) => c.id === contactId);
  const [f, setF] = useState({
    date: event?.date ?? (initialDate ? toYmd(initialDate) : (contact?.eventDate ?? '')),
    startTime: event?.startTime ?? '18:00',
    endTime: event?.endTime ?? '23:00',
    guestCount: (event?.guestCount ?? contact?.guestCount ?? '').toString(),
    space: event?.space ?? ('altar_room' as Space),
    status: event?.status === 'cancelled' ? 'confirmed' : (event?.status ?? ('confirmed' as EventStatus)),
    notes: event?.notes ?? '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const clash = f.date ? clashFor(data, f.date, event?.id) : undefined;
  const clashName = clash ? fullName(data.contacts.find((c) => c.id === clash.contactId) ?? { firstName: 'Another', lastName: 'booking' }) : '';
  const guests = Number(f.guestCount) || null;

  const pickContact = (id: string) => {
    setContactId(id);
    const c = data.contacts.find((x) => x.id === id);
    if (c && !event) {
      setF((p) => ({
        ...p,
        date: p.date || c.eventDate || '',
        guestCount: p.guestCount || (c.guestCount?.toString() ?? ''),
      }));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!contactId || !f.date) return;
    const input: EventInput = {
      date: f.date,
      startTime: f.startTime,
      endTime: f.endTime,
      guestCount: guests,
      space: guests && guests > RULES.altarRoomCapacity ? 'altar_room_plus' : f.space,
      status: f.status as EventStatus,
      notes: f.notes.trim(),
    };
    if (event) {
      updateEvent(event.id, input);
      toast('Event updated');
    } else {
      bookEvent(contactId, input);
      toast(`${input.status === 'hold' ? 'Date held' : 'Event booked'} for ${picked?.firstName ?? 'client'}`);
    }
    onDone();
  };

  return (
    <form onSubmit={submit} className="form-grid">
      {!contact && !event && (
        <label className="field wide">
          <span>Client</span>
          <select id="ev-contact" className="select" required value={contactId} onChange={(e) => pickContact(e.target.value)}>
            <option value="">Choose a contact…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {fullName(c)} · {STAGE_LABEL[c.stage]}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field wide">
        <span>Date</span>
        <input id="ev-date" className="input" type="date" required value={f.date} onChange={set('date')} />
      </label>
      <label className="field">
        <span>Starts</span>
        <input id="ev-start" className="input" type="time" required value={f.startTime} onChange={set('startTime')} />
      </label>
      <label className="field">
        <span>Ends</span>
        <input id="ev-end" className="input" type="time" required value={f.endTime} onChange={set('endTime')} />
      </label>
      <label className="field">
        <span>Guests</span>
        <input id="ev-guests" className="input" type="number" min="1" value={f.guestCount} onChange={set('guestCount')} />
      </label>
      <label className="field">
        <span>Space</span>
        <select id="ev-space" className="select" value={guests && guests > RULES.altarRoomCapacity ? 'altar_room_plus' : f.space} onChange={set('space')}>
          <option value="altar_room">{SPACE_LABEL.altar_room}</option>
          <option value="altar_room_plus">{SPACE_LABEL.altar_room_plus}</option>
        </select>
      </label>
      <fieldset className="field wide" style={{ border: 0, padding: 0, margin: 0 }}>
        <span>Status</span>
        <div className="segmented" role="group" aria-label="Status">
          <button type="button" aria-pressed={f.status === 'confirmed'} onClick={() => setF((p) => ({ ...p, status: 'confirmed' }))}>
            Confirmed (deposit paid)
          </button>
          <button type="button" aria-pressed={f.status === 'hold'} onClick={() => setF((p) => ({ ...p, status: 'hold' }))}>
            Hold (pencilled in)
          </button>
        </div>
      </fieldset>
      <label className="field wide">
        <span>Notes (optional)</span>
        <input id="ev-notes" className="input" placeholder="e.g. DJ from 8pm, grazing tables" value={f.notes} onChange={set('notes')} />
      </label>
      {clash && (
        <p className="wide flag bad" style={{ whiteSpace: 'normal', padding: '8px 10px' }}>
          {formatDate(f.date)} already has {clashName}'s event ({clash.status === 'hold' ? 'on hold' : 'confirmed'}). The venue runs one event at a
          time. You can still save, but it will show as a clash.
        </p>
      )}
      {guests && guests > RULES.altarRoomCapacity ? (
        <p className="wide small muted" style={{ margin: 0 }}>
          Over {RULES.altarRoomCapacity} guests: second space needed (160+ confirmed, 4 weeks’ notice, fixed surcharge).
        </p>
      ) : null}
      {f.status === 'confirmed' && !event && picked && !['confirmed', 'event_held'].includes(picked.stage) && (
        <p className="wide small muted" style={{ margin: 0 }}>
          Confirming moves {picked.firstName} to the Confirmed stage.
        </p>
      )}
      <div className="modal-actions wide">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={!contactId || !f.date}>
          {event ? 'Save event' : f.status === 'hold' ? 'Hold the date' : 'Book event'}
        </button>
      </div>
    </form>
  );
}

/** One "new booking" window with a switch between a venue tour and an event. */
export function NewBookingModal({
  initialDate,
  initialKind = 'tour',
  contact,
  onClose,
}: {
  initialDate?: Date;
  initialKind?: 'tour' | 'event';
  contact?: Contact;
  onClose: () => void;
}) {
  const [kind, setKind] = useState(initialKind);
  const title = initialDate ? `New booking · ${format(initialDate, 'EEE d MMM')}` : 'New booking';
  return (
    <Modal title={title} onClose={onClose}>
      <div className="segmented" role="group" aria-label="What are you booking?">
        <button type="button" aria-pressed={kind === 'tour'} onClick={() => setKind('tour')}>
          Venue tour
        </button>
        <button type="button" aria-pressed={kind === 'event'} onClick={() => setKind('event')}>
          Event
        </button>
      </div>
      {kind === 'tour' ? (
        <TourForm contact={contact} initialDate={initialDate} onDone={onClose} onCancel={onClose} />
      ) : (
        <EventForm contact={contact} initialDate={initialDate} onDone={onClose} onCancel={onClose} />
      )}
    </Modal>
  );
}

export function EditEventModal({ event, onClose }: { event: VenueEvent; onClose: () => void }) {
  return (
    <Modal title="Edit event" onClose={onClose}>
      <EventForm event={event} onDone={onClose} onCancel={onClose} />
    </Modal>
  );
}

// ---------- Event card ----------

export function EventCard({ event, onEdit, showDate = true }: { event: VenueEvent; onEdit: (e: VenueEvent) => void; showDate?: boolean }) {
  const { data, insights, updateEvent } = useStore();
  const toast = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const c = insights.get(event.contactId)?.contact;
  if (!c) return null;
  const clash = event.status !== 'cancelled' ? clashFor(data, event.date, event.id) : undefined;
  const past = event.date < toYmd(new Date());
  return (
    <article className={`deal tour-card event-card ev-${event.status}`}>
      <div className="top">
        <div>
          {showDate && <div className="tour-day">{formatDate(event.date, 'EEE d MMM yyyy')}</div>}
          <div className="tour-time">{eventTimes(event)}</div>
        </div>
        <span className={`flag ${event.status === 'confirmed' ? 'ev-confirmed-flag' : event.status === 'hold' ? 'warn' : 'plain-flag'}`}>
          {event.status === 'confirmed' ? (past ? 'Held' : 'Confirmed') : event.status === 'hold' ? 'On hold' : 'Cancelled'}
        </span>
      </div>
      <div>
        <Link to={`/contacts/${c.id}`} className="who">
          {fullName(c)}
        </Link>
        <div className="what">
          {data.eventTypes.find((e) => e.id === c.eventTypeId)?.name ?? 'Event'}
          {c.company ? ` · ${c.company}` : ''}
          <br />
          {event.guestCount ? `${event.guestCount} guests · ` : ''}
          {SPACE_LABEL[event.space]}
        </div>
      </div>
      {event.notes && <div className="what tour-notes">“{event.notes}”</div>}
      {clash && <span className="flag bad">Clash: another event this date</span>}
      <div className="bottom">
        <span className="num">{formatMoney(c.estimatedValue)}</span>
        <span className="card-people">
          <EmailButton contact={c} compact />
          <OwnerDot id={c.ownerId} />
        </span>
      </div>
      {event.status !== 'cancelled' && !past && (
        <div className="tour-actions">
          {confirmCancel ? (
            <>
              <span className="small">Cancel this event?</span>
              <button
                className="btn small danger solid"
                onClick={() => {
                  updateEvent(event.id, { status: 'cancelled' });
                  toast('Event cancelled');
                  setConfirmCancel(false);
                }}
              >
                Yes, cancel
              </button>
              <button className="btn small" onClick={() => setConfirmCancel(false)}>
                Keep
              </button>
            </>
          ) : (
            <>
              {event.status === 'hold' && (
                <button
                  className="btn small primary"
                  onClick={() => {
                    updateEvent(event.id, { status: 'confirmed' });
                    toast(`${c.firstName}'s event confirmed`);
                  }}
                >
                  Confirm
                </button>
              )}
              <button className="btn small" onClick={() => onEdit(event)}>
                Edit / move
              </button>
              <button className="btn small ghost" onClick={() => setConfirmCancel(true)}>
                Cancel
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

// ---------- Booking detail (click on the calendar) ----------

export type BookingRef = { kind: 'tour'; tour: Tour } | { kind: 'event'; event: VenueEvent };

export function BookingDetailModal({
  booking,
  onClose,
  onEditClient,
  onReschedule,
  onEditEvent,
}: {
  booking: BookingRef;
  onClose: () => void;
  onEditClient: (c: Contact) => void;
  onReschedule: (t: Tour) => void;
  onEditEvent: (e: VenueEvent) => void;
}) {
  const { data, insights } = useStore();
  const contactId = booking.kind === 'tour' ? booking.tour.contactId : booking.event.contactId;
  const i = insights.get(contactId);
  // Re-read the booking so the window updates after an action.
  const liveTour = booking.kind === 'tour' ? data.tours.find((t) => t.id === booking.tour.id) : undefined;
  const liveEvent = booking.kind === 'event' ? data.events.find((e) => e.id === booking.event.id) : undefined;
  if (!i) return null;
  const c = i.contact;
  const row = (label: string, value: ReactNode) => (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
  return (
    <Modal title={fullName(c)} onClose={onClose}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: -8 }}>
        <StatusTag stage={c.stage} />
        <span className="small muted">{STAGE_LABEL[c.stage]}</span>
      </div>
      <dl className="facts">
        {row('Phone', c.phone || '—')}
        {row('Email', <EmailLink contact={c} />)}
        {row('Event type', data.eventTypes.find((e) => e.id === c.eventTypeId)?.name ?? '—')}
        {row('Guests', c.guestCount ?? '—')}
        {row('Company', c.company || '—')}
        {row('Source', SOURCE_LABEL[c.source])}
      </dl>
      {liveTour && (
        <TourCard
          tour={liveTour}
          showDate
          onReschedule={(t) => {
            onClose();
            onReschedule(t);
          }}
        />
      )}
      {liveEvent && (
        <EventCard
          event={liveEvent}
          onEdit={(e) => {
            onClose();
            onEditEvent(e);
          }}
        />
      )}
      <div className="modal-actions">
        <button
          className="btn"
          onClick={() => {
            onClose();
            onEditClient(c);
          }}
        >
          Edit client details
        </button>
        <EmailButton contact={c} label="Email client" />
        <Link to={`/contacts/${c.id}`} className="btn primary" onClick={onClose}>
          Open client profile
        </Link>
      </div>
    </Modal>
  );
}

/** A yes/no question inside the page (browser pop-ups don't work everywhere). */
export function ConfirmModal({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div>{children}</div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
