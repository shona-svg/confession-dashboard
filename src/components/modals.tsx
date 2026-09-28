import { useState, type FormEvent } from 'react';
import { useStore, type NewContact } from '../data/store';
import type { ActivityType, Audience, Contact, LostReason, Source, Stage } from '../data/types';
import { AUDIENCES, JOURNEY, LOST_REASONS, SOURCES, STAGE_LABEL } from '../lib/stages';
import { fullName, toLocalInput } from '../lib/format';
import { Modal, useToast } from './ui';

// ---------- Add / edit contact ----------

export function ContactFormModal({
  contact,
  onClose,
  onSaved,
}: {
  contact?: Contact;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const { data, addContact, updateContact } = useStore();
  const toast = useToast();
  const [f, setF] = useState({
    firstName: contact?.firstName ?? '',
    lastName: contact?.lastName ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    company: contact?.company ?? '',
    eventTypeId: contact?.eventTypeId ?? '',
    audience: contact?.audience ?? ('milestone' as Audience),
    eventDate: contact?.eventDate ?? '',
    guestCount: contact?.guestCount?.toString() ?? '',
    estimatedValue: contact?.estimatedValue?.toString() ?? '',
    source: contact?.source ?? ('website_form' as Source),
    ownerId: contact?.ownerId ?? data.team[0]?.id ?? '',
    stage: contact?.stage ?? ('lead' as Stage),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    const value = e.target.value;
    setF((prev) => {
      const next = { ...prev, [k]: value };
      // Picking an event type suggests its usual audience (can still be changed).
      if (k === 'eventTypeId' && !contact) {
        const et = data.eventTypes.find((x) => x.id === value);
        if (et && prev.audience !== 'accessibility') next.audience = et.defaultAudience;
      }
      return next;
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      email: f.email.trim().toLowerCase(),
      phone: f.phone.trim(),
      company: f.company.trim(),
      eventTypeId: f.eventTypeId || null,
      audience: f.audience,
      eventDate: f.eventDate || null,
      guestCount: f.guestCount ? Number(f.guestCount) : null,
      estimatedValue: f.estimatedValue ? Number(f.estimatedValue) : null,
      source: f.source,
      ownerId: f.ownerId || null,
    };
    if (contact) {
      updateContact(contact.id, payload);
      toast('Contact saved');
      onClose();
    } else {
      const input: NewContact = { ...payload, tags: [], stage: f.stage };
      const id = addContact(input);
      toast(`${fullName(payload)} added as ${STAGE_LABEL[f.stage]}`);
      onSaved?.(id);
      onClose();
    }
  };

  return (
    <Modal title={contact ? 'Edit contact' : 'New enquiry'} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <label className="field">
          <span>First name</span>
          <input id="cf-first" className="input" required value={f.firstName} onChange={set('firstName')} />
        </label>
        <label className="field">
          <span>Last name</span>
          <input id="cf-last" className="input" value={f.lastName} onChange={set('lastName')} />
        </label>
        <label className="field">
          <span>Email</span>
          <input id="cf-email" className="input" type="email" required value={f.email} onChange={set('email')} />
        </label>
        <label className="field">
          <span>Phone</span>
          <input id="cf-phone" className="input" type="tel" value={f.phone} onChange={set('phone')} />
        </label>
        <label className="field wide">
          <span>Company (corporate bookings)</span>
          <input id="cf-company" className="input" value={f.company} onChange={set('company')} />
        </label>
        <label className="field">
          <span>Event type</span>
          <select id="cf-type" className="select" value={f.eventTypeId} onChange={set('eventTypeId')}>
            <option value="">Not known yet</option>
            {data.eventTypes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Audience</span>
          <select id="cf-audience" className="select" value={f.audience} onChange={set('audience')}>
            {AUDIENCES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Event date</span>
          <input id="cf-date" className="input" type="date" value={f.eventDate} onChange={set('eventDate')} />
        </label>
        <label className="field">
          <span>Guests</span>
          <input id="cf-guests" className="input" type="number" min="1" value={f.guestCount} onChange={set('guestCount')} />
        </label>
        <label className="field">
          <span>Estimated value ($)</span>
          <input
            id="cf-value"
            className="input"
            type="number"
            min="0"
            step="50"
            placeholder="Pricing TBC"
            value={f.estimatedValue}
            onChange={set('estimatedValue')}
          />
        </label>
        <label className="field">
          <span>Source</span>
          <select id="cf-source" className="select" value={f.source} onChange={set('source')}>
            {SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Owner</span>
          <select id="cf-owner" className="select" value={f.ownerId} onChange={set('ownerId')}>
            <option value="">Unassigned</option>
            {data.team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        {!contact && (
          <label className="field">
            <span>Starting stage</span>
            <select id="cf-stage" className="select" value={f.stage} onChange={set('stage')}>
              {JOURNEY.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        )}
        {f.guestCount && Number(f.guestCount) > 150 && (
          <p className="wide flag warn" style={{ whiteSpace: 'normal', padding: '8px 10px' }}>
            Over 150 guests: that's more than the Altar Room holds, so this needs the second-room conversation (160+ confirmed, 4 weeks’ notice).
          </p>
        )}
        <div className="modal-actions wide">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            {contact ? 'Save changes' : 'Add enquiry'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Lost reason ----------

export function LostModal({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const { moveStage } = useStore();
  const toast = useToast();
  const [reason, setReason] = useState<LostReason | ''>('');
  const [note, setNote] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    moveStage(contact.id, 'lost', { reason, note: note.trim() });
    toast(`${fullName(contact)} marked as lost`);
    onClose();
  };
  return (
    <Modal title={`Why was ${contact.firstName} lost?`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small muted" style={{ marginBottom: 8 }}>
            A reason is required so the lost-reasons report stays accurate.
          </legend>
          <div className="reason-grid">
            {LOST_REASONS.map((r) => (
              <label key={r.id}>
                <input
                  type="radio"
                  name="lost-reason"
                  id={`lost-${r.id}`}
                  value={r.id}
                  checked={reason === r.id}
                  onChange={() => setReason(r.id)}
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span>Note {reason === 'other' ? '(please explain)' : '(optional)'}</span>
          <textarea
            id="lost-note"
            className="textarea"
            value={note}
            required={reason === 'other'}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn danger solid" disabled={!reason}>
            Mark as lost
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Log call / note / email ----------

const LOG_TYPES: { id: ActivityType; label: string; placeholder: string }[] = [
  { id: 'call', label: 'Call', placeholder: 'e.g. Talked through Saturday dates, sending the proposal Thursday' },
  { id: 'email_out', label: 'Email sent', placeholder: 'e.g. Sent tour times for next week' },
  { id: 'email_in', label: 'Email received', placeholder: 'e.g. Asked about bump-in for their stylist' },
  { id: 'note', label: 'Note', placeholder: 'e.g. Partner is a wheelchair user, keen on the dance floor' },
];

export function LogActivityModal({
  contact,
  initialType = 'call',
  onClose,
}: {
  contact: Contact;
  initialType?: ActivityType;
  onClose: () => void;
}) {
  const { logActivity } = useStore();
  const toast = useToast();
  const [type, setType] = useState<ActivityType>(initialType);
  const [summary, setSummary] = useState('');
  const [when, setWhen] = useState(toLocalInput(Date.now()));
  const current = LOG_TYPES.find((x) => x.id === type)!;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    logActivity(contact.id, type, summary.trim() || current.label, new Date(when).toISOString());
    toast(`${current.label} logged for ${contact.firstName}`);
    onClose();
  };
  return (
    <Modal title={`Log for ${fullName(contact)}`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="segmented" role="group" aria-label="What happened">
          {LOG_TYPES.map((t) => (
            <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>What happened</span>
          <textarea
            id="log-summary"
            className="textarea"
            placeholder={current.placeholder}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>
        <label className="field">
          <span>When</span>
          <input id="log-when" className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        {type === 'note' ? (
          <p className="small muted">Notes don't reset the 5-day follow-up clock. Calls and emails do.</p>
        ) : (
          <p className="small muted">This is a record only. Nothing is sent to the client.</p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Save to timeline
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Book a tour ----------

function nextTourSlot(): number {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(11, 0, 0, 0);
  return d.getTime();
}

export function BookTourModal({ contact, onClose }: { contact?: Contact; onClose: () => void }) {
  const { data, bookTour } = useStore();
  const toast = useToast();
  const candidates = data.contacts
    .filter((c) => c.stage !== 'event_held')
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const [contactId, setContactId] = useState(contact?.id ?? '');
  const [when, setWhen] = useState(toLocalInput(nextTourSlot()));
  const [hostId, setHostId] = useState(contact?.ownerId ?? data.team[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!contactId) return;
    bookTour(contactId, new Date(when).toISOString(), hostId || null, notes.trim());
    const c = data.contacts.find((x) => x.id === contactId)!;
    toast(`Tour booked for ${c.firstName}`);
    onClose();
  };
  return (
    <Modal title="Book a venue tour" onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        {!contact && (
          <label className="field wide">
            <span>Who's coming</span>
            <select id="tour-contact" className="select" required value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">Choose a contact…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c)} · {STAGE_LABEL[c.stage]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Date and time</span>
          <input id="tour-when" className="input" type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <label className="field">
          <span>Host</span>
          <select id="tour-host" className="select" value={hostId} onChange={(e) => setHostId(e.target.value)}>
            <option value="">Unassigned</option>
            {data.team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field wide">
          <span>Notes (optional)</span>
          <input
            id="tour-notes"
            className="input"
            placeholder="e.g. Bringing partner and mum"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <p className="wide small muted">
          Invite the whole decision-making group: partner, parent, colleague. Remember, no pricing on the tour.
        </p>
        <div className="modal-actions wide">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!contactId}>
            Book tour
          </button>
        </div>
      </form>
    </Modal>
  );
}
