import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday } from 'date-fns';
import { useStore, useTeamName } from '../data/store';
import type { Tour, TourStatus } from '../data/types';
import { STAGE_LABEL } from '../lib/stages';
import { formatDate, formatDateTime, formatTime, fullName, toLocalInput } from '../lib/format';
import { Modal, OwnerDot, useToast } from './ui';

const STATUS_LABEL: Record<TourStatus, string> = {
  booked: 'Booked',
  attended: 'Attended',
  no_show: 'No-show',
  cancelled: 'Cancelled',
};

/** One tour, laid out like a pipeline card, with the actions that make sense right now. */
export function TourCard({ tour, onReschedule, showDate = false }: { tour: Tour; onReschedule: (t: Tour) => void; showDate?: boolean }) {
  const { data, insights, now, setTourStatus } = useStore();
  const toast = useToast();
  const teamName = useTeamName();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const c = insights.get(tour.contactId)?.contact;
  if (!c) return null;
  const at = new Date(tour.scheduledFor).getTime();
  const startedOrToday = at < now || isToday(at);
  const future = at >= now;
  const ahead = Math.round((at - new Date(tour.bookedAt).getTime()) / 86_400_000);
  const needsOutcome = tour.status === 'booked' && at < now;

  const mark = (status: TourStatus) => {
    setTourStatus(tour.id, status);
    toast(`${c.firstName}: ${STATUS_LABEL[status].toLowerCase()}`);
    setConfirmCancel(false);
  };

  return (
    <article className={`deal tour-card status-${tour.status}${needsOutcome ? ' needs' : ''}`}>
      <div className="top">
        <div>
          {showDate && <div className="tour-day">{format(at, 'EEE d MMM')}</div>}
          <div className="tour-time">{formatTime(tour.scheduledFor)}</div>
        </div>
        {tour.status === 'booked' ? (
          needsOutcome ? <span className="flag warn">Needs outcome</span> : <span className="flag tour-booked">Booked</span>
        ) : (
          <span className={`flag ${tour.status === 'attended' ? 'good' : tour.status === 'no_show' ? 'bad' : 'plain-flag'}`}>
            {STATUS_LABEL[tour.status]}
          </span>
        )}
      </div>
      <div>
        <Link to={`/contacts/${c.id}`} className="who">
          {fullName(c)}
        </Link>
        <div className="what">
          {data.eventTypes.find((e) => e.id === c.eventTypeId)?.name ?? 'Event TBC'}
          {c.company ? ` · ${c.company}` : ''}
          <br />
          {c.guestCount ? `${c.guestCount} guests · ` : ''}
          {c.eventDate ? formatDate(c.eventDate, 'd MMM yyyy') : 'Date TBC'} · {STAGE_LABEL[c.stage]}
        </div>
      </div>
      {tour.notes && <div className="what tour-notes">“{tour.notes}”</div>}
      <div className="bottom">
        <span>
          Booked {formatDate(tour.bookedAt, 'd MMM')} · {ahead} {ahead === 1 ? 'day' : 'days'} ahead
        </span>
        <OwnerDot id={tour.hostId} />
      </div>
      {tour.status === 'booked' && (
        <div className="tour-actions">
          {confirmCancel ? (
            <>
              <span className="small">Cancel this tour?</span>
              <button className="btn small danger solid" onClick={() => mark('cancelled')}>
                Yes, cancel
              </button>
              <button className="btn small" onClick={() => setConfirmCancel(false)}>
                Keep
              </button>
            </>
          ) : (
            <>
              {startedOrToday && (
                <>
                  <button className="btn small primary" onClick={() => mark('attended')}>
                    Attended
                  </button>
                  <button className="btn small" onClick={() => mark('no_show')}>
                    No-show
                  </button>
                </>
              )}
              <button className="btn small" onClick={() => onReschedule(tour)}>
                {future ? 'Reschedule' : 'Rebook'}
              </button>
              {future && (
                <button className="btn small ghost" onClick={() => setConfirmCancel(true)}>
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      )}
      {tour.status === 'no_show' && (
        <div className="tour-actions">
          <button className="btn small" onClick={() => onReschedule(tour)}>
            Rebook
          </button>
        </div>
      )}
      <span className="sr-only">Host: {teamName(tour.hostId)}</span>
    </article>
  );
}

export function RescheduleModal({ tour, onClose }: { tour: Tour; onClose: () => void }) {
  const { data, insights, rescheduleTour } = useStore();
  const toast = useToast();
  const c = insights.get(tour.contactId)?.contact;
  const start = Math.max(new Date(tour.scheduledFor).getTime(), Date.now() + 86_400_000);
  const [when, setWhen] = useState(toLocalInput(start));
  const [hostId, setHostId] = useState(tour.hostId ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    rescheduleTour(tour.id, new Date(when).toISOString(), hostId || null);
    toast(`Tour moved to ${formatDateTime(new Date(when).getTime())}`);
    onClose();
  };
  return (
    <Modal title={tour.status === 'no_show' ? 'Rebook the tour' : 'Reschedule tour'} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <p className="wide small muted" style={{ margin: 0 }}>
          {c ? fullName(c) : 'Tour'} · currently {formatDateTime(tour.scheduledFor)}
        </p>
        <label className="field">
          <span>New date and time</span>
          <input id="rs-when" className="input" type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <label className="field">
          <span>Host</span>
          <select id="rs-host" className="select" value={hostId} onChange={(e) => setHostId(e.target.value)}>
            <option value="">Unassigned</option>
            {data.team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <p className="wide small muted" style={{ margin: 0 }}>
          The move is recorded on their timeline. Once Google Calendar is connected, the calendar event moves too.
        </p>
        <div className="modal-actions wide">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Save new time
          </button>
        </div>
      </form>
    </Modal>
  );
}
