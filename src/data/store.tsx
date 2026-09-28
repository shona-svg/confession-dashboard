// The dashboard's data and every action that changes it.
// Phase 2: sample data, saved in this browser only.
// Phase 3: the same actions will read and write Supabase instead.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { generateSampleData } from './sampleData';
import type {
  Activity,
  ActivityType,
  Audience,
  Contact,
  Dataset,
  LostReason,
  Source,
  Stage,
  Tour,
  TourStatus,
  VenueEvent,
} from './types';
import { stageIndex } from '../lib/stages';
import { buildInsights, type Insight } from '../lib/metrics';

const STORAGE_KEY = 'confession-dashboard-sample-v3';
/** Stand-in for "the signed-in team member" until login arrives in phase 3. */
export const CURRENT_USER_ID = 'tm-sam';

function load(): Dataset {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Dataset;
  } catch {
    // Storage blocked or data unreadable: fall back to fresh sample data.
  }
  return generateSampleData();
}

function save(data: Dataset) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Not fatal: changes just won't survive a reload.
  }
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const nowIso = () => new Date().toISOString();

export type NewContact = Omit<
  Contact,
  'id' | 'createdAt' | 'lostReason' | 'lostReasonNote' | 'lostFromStage' | 'reviewRequestedAt' | 'reviewReceived' | 'acknowledgedAt'
>;

export type EventInput = Pick<VenueEvent, 'date' | 'startTime' | 'endTime' | 'space' | 'guestCount' | 'status' | 'notes'>;

/** What the public enquiry form collects. */
export interface EnquiryInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  eventTypeId: string | null;
  eventDate: string | null;
  flexibleDate: boolean;
  guestCount: number | null;
  heardFrom: Source;
  accessibility: boolean;
  message: string;
  marketingOptIn: boolean;
}

interface StoreValue {
  data: Dataset;
  insights: Map<string, Insight>;
  now: number;
  addContact(input: NewContact): string;
  updateContact(id: string, patch: Partial<Contact>): void;
  deleteContact(id: string): void;
  moveStage(id: string, to: Stage, lost?: { reason: LostReason; note: string }): void;
  logActivity(contactId: string, type: ActivityType, summary: string, occurredAt?: string): void;
  bookTour(contactId: string, scheduledFor: string, hostId: string | null, notes: string): void;
  setTourStatus(tourId: string, status: TourStatus): void;
  rescheduleTour(tourId: string, scheduledFor: string, hostId: string | null): void;
  acknowledge(contactId: string): void;
  bookEvent(contactId: string, input: EventInput): void;
  updateEvent(eventId: string, patch: Partial<EventInput>): void;
  submitEnquiry(input: EnquiryInput): string;
  requestReview(contactId: string): void;
  resetSampleData(): void;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Confirmed events whose date has passed move to Event held automatically. */
function applyAutomaticMoves(data: Dataset): Dataset {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = data.contacts.filter(
    (c) => c.stage === 'confirmed' && c.eventDate && new Date(c.eventDate + 'T00:00:00') < today,
  );
  if (!due.length) return data;
  const at = nowIso();
  return {
    ...data,
    contacts: data.contacts.map((c) => (due.includes(c) ? { ...c, stage: 'event_held' as Stage } : c)),
    stageChanges: [
      ...data.stageChanges,
      ...due.map((c) => ({
        id: newId('sc'),
        contactId: c.id,
        fromStage: 'confirmed' as Stage,
        toStage: 'event_held' as Stage,
        changedAt: at,
        changedBy: 'Automatic',
      })),
    ],
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset>(() => applyAutomaticMoves(load()));
  const [now, setNow] = useState(() => Date.now());

  const dataRef = useRef(data);
  dataRef.current = data;
  useEffect(() => save(data), [data]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const insights = useMemo(() => buildInsights(data, now), [data, now]);

  const activity = (contactId: string, type: ActivityType, summary: string, occurredAt = nowIso()): Activity => ({
    id: newId('act'),
    contactId,
    type,
    occurredAt,
    summary,
    createdBy: CURRENT_USER_ID,
  });

  /** Changes a stage and writes the history row, the way the database trigger will. */
  const withStage = (d: Dataset, contactId: string, to: Stage, lost?: { reason: LostReason; note: string }): Dataset => {
    const c = d.contacts.find((x) => x.id === contactId);
    if (!c || c.stage === to) return d;
    const patch: Partial<Contact> =
      to === 'lost'
        ? { stage: to, lostReason: lost?.reason ?? 'other', lostReasonNote: lost?.note ?? '', lostFromStage: c.stage }
        : { stage: to, lostReason: null, lostReasonNote: '', lostFromStage: null };
    const extra: Activity[] = to === 'proposal_sent' ? [activity(contactId, 'proposal_sent', 'Proposal sent')] : [];
    return {
      ...d,
      contacts: d.contacts.map((x) => (x.id === contactId ? { ...x, ...patch } : x)),
      stageChanges: [
        ...d.stageChanges,
        { id: newId('sc'), contactId, fromStage: c.stage, toStage: to, changedAt: nowIso(), changedBy: CURRENT_USER_ID },
      ],
      activities: [...d.activities, ...extra],
    };
  };

  const addContact = useCallback((input: NewContact) => {
    const id = newId('c');
    setData((d) => {
      const contact: Contact = {
        ...input,
        id,
        createdAt: nowIso(),
        lostReason: null,
        lostReasonNote: '',
        lostFromStage: null,
        reviewRequestedAt: null,
        reviewReceived: false,
        acknowledgedAt: null,
      };
      return {
        ...d,
        contacts: [...d.contacts, contact],
        stageChanges: [
          ...d.stageChanges,
          { id: newId('sc'), contactId: id, fromStage: null, toStage: input.stage, changedAt: nowIso(), changedBy: CURRENT_USER_ID },
        ],
      };
    });
    return id;
  }, []);

  const updateContact = useCallback((id: string, patch: Partial<Contact>) => {
    setData((d) => ({ ...d, contacts: d.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }, []);

  const deleteContact = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      contacts: d.contacts.filter((c) => c.id !== id),
      stageChanges: d.stageChanges.filter((x) => x.contactId !== id),
      tours: d.tours.filter((x) => x.contactId !== id),
      events: d.events.filter((x) => x.contactId !== id),
      activities: d.activities.filter((x) => x.contactId !== id),
    }));
  }, []);

  const moveStage = useCallback((id: string, to: Stage, lost?: { reason: LostReason; note: string }) => {
    setData((d) => withStage(d, id, to, lost));
  }, []);

  const logActivity = useCallback((contactId: string, type: ActivityType, summary: string, occurredAt?: string) => {
    setData((d) => ({ ...d, activities: [...d.activities, activity(contactId, type, summary, occurredAt)] }));
  }, []);

  const bookTour = useCallback((contactId: string, scheduledFor: string, hostId: string | null, notes: string) => {
    setData((d) => {
      const tour: Tour = { id: newId('tour'), contactId, scheduledFor, bookedAt: nowIso(), status: 'booked', hostId, notes };
      const when = new Date(scheduledFor).toLocaleString('en-AU', {
        weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
      });
      let next: Dataset = {
        ...d,
        tours: [...d.tours, tour],
        activities: [...d.activities, activity(contactId, 'tour_booked', `Tour booked for ${when}`)],
      };
      const c = d.contacts.find((x) => x.id === contactId);
      if (c && ['prospect', 'lead', 'lost'].includes(c.stage)) next = withStage(next, contactId, 'tour_booked');
      return next;
    });
  }, []);

  const setTourStatus = useCallback((tourId: string, status: TourStatus) => {
    setData((d) => {
      const tour = d.tours.find((x) => x.id === tourId);
      if (!tour) return d;
      const type: ActivityType =
        status === 'attended' ? 'tour_attended' : status === 'no_show' ? 'tour_no_show' : 'tour_cancelled';
      const label = status === 'attended' ? 'Tour attended' : status === 'no_show' ? 'Didn’t make it to the tour' : 'Tour cancelled';
      let next: Dataset = {
        ...d,
        tours: d.tours.map((x) => (x.id === tourId ? { ...x, status } : x)),
        activities: [...d.activities, activity(tour.contactId, type, label)],
      };
      const c = d.contacts.find((x) => x.id === tour.contactId);
      if (status === 'attended' && c && ['prospect', 'lead', 'tour_booked'].includes(c.stage)) {
        next = withStage(next, tour.contactId, 'toured');
      }
      // A cancelled tour with nothing else booked puts them back to Lead.
      const otherBooked = d.tours.some((x) => x.id !== tourId && x.contactId === tour.contactId && x.status === 'booked');
      if (status === 'cancelled' && c?.stage === 'tour_booked' && !otherBooked) {
        next = withStage(next, tour.contactId, 'lead');
      }
      return next;
    });
  }, []);

  const rescheduleTour = useCallback((tourId: string, scheduledFor: string, hostId: string | null) => {
    setData((d) => {
      const tour = d.tours.find((x) => x.id === tourId);
      if (!tour) return d;
      const fmt = (iso: string) =>
        new Date(iso).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
      return {
        ...d,
        tours: d.tours.map((x) => (x.id === tourId ? { ...x, scheduledFor, hostId, status: 'booked' } : x)),
        activities: [
          ...d.activities,
          activity(tour.contactId, 'tour_rescheduled', `Moved from ${fmt(tour.scheduledFor)} to ${fmt(scheduledFor)}`),
        ],
      };
    });
  }, []);

  const acknowledge = useCallback((contactId: string) => {
    setData((d) => ({
      ...d,
      contacts: d.contacts.map((c) => (c.id === contactId ? { ...c, acknowledgedAt: nowIso() } : c)),
    }));
  }, []);

  const niceDay = (date: string) =>
    new Date(date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const bookEvent = useCallback((contactId: string, input: EventInput) => {
    setData((d) => {
      const ev: VenueEvent = { ...input, id: newId('ev'), contactId, createdAt: nowIso() };
      const label = input.status === 'hold' ? 'Date on hold' : 'Event booked';
      let next: Dataset = {
        ...d,
        events: [...d.events, ev],
        contacts: d.contacts.map((c) =>
          c.id === contactId ? { ...c, eventDate: input.date, guestCount: input.guestCount ?? c.guestCount } : c,
        ),
        activities: [...d.activities, activity(contactId, 'event_booked', `${label}: ${niceDay(input.date)}, ${input.startTime}–${input.endTime}`)],
      };
      const c = d.contacts.find((x) => x.id === contactId);
      if (input.status === 'confirmed' && c && (c.stage === 'lost' || stageIndex(c.stage) < stageIndex('confirmed'))) {
        next = withStage(next, contactId, 'confirmed');
      }
      return next;
    });
  }, []);

  const updateEvent = useCallback((eventId: string, patch: Partial<EventInput>) => {
    setData((d) => {
      const ev = d.events.find((x) => x.id === eventId);
      if (!ev) return d;
      const updated = { ...ev, ...patch };
      const extra: Activity[] = [];
      if (patch.date && patch.date !== ev.date) {
        extra.push(activity(ev.contactId, 'event_moved', `Moved from ${niceDay(ev.date)} to ${niceDay(patch.date)}`));
      }
      if (patch.status === 'cancelled' && ev.status !== 'cancelled') {
        extra.push(activity(ev.contactId, 'event_cancelled', `Event on ${niceDay(ev.date)} cancelled`));
      }
      if (patch.status === 'confirmed' && ev.status === 'hold') {
        extra.push(activity(ev.contactId, 'event_booked', `Hold confirmed: ${niceDay(updated.date)}`));
      }
      let next: Dataset = {
        ...d,
        events: d.events.map((x) => (x.id === eventId ? updated : x)),
        contacts: d.contacts.map((c) =>
          c.id === ev.contactId && updated.status !== 'cancelled' ? { ...c, eventDate: updated.date } : c,
        ),
        activities: [...d.activities, ...extra],
      };
      const c = d.contacts.find((x) => x.id === ev.contactId);
      if (patch.status === 'confirmed' && c && (c.stage === 'lost' || stageIndex(c.stage) < stageIndex('confirmed'))) {
        next = withStage(next, ev.contactId, 'confirmed');
      }
      return next;
    });
  }, []);

  const submitEnquiry = useCallback((input: EnquiryInput) => {
    const email = input.email.trim().toLowerCase();
    // Work out the id now: state updates run later, so they can't hand a value back.
    const known = dataRef.current.contacts.find((c) => c.email.toLowerCase() === email);
    const resultId = known?.id ?? newId('c');
    setData((d) => {
      const eventType = d.eventTypes.find((e) => e.id === input.eventTypeId);
      const what = [
        eventType?.name ?? 'Event type not given',
        input.guestCount ? `about ${input.guestCount} guests` : null,
        input.eventDate ? `${niceDay(input.eventDate)}${input.flexibleDate ? ' (flexible)' : ''}` : null,
      ]
        .filter(Boolean)
        .join(', ');
      const summary = `Website enquiry form: ${what}${input.message ? `. “${input.message.trim()}”` : ''}`;
      const at = nowIso();
      const existing = d.contacts.find((c) => c.email.toLowerCase() === email);
      // Someone already known: update what they told us and log the new enquiry.
      if (existing) {
        let next: Dataset = {
          ...d,
          contacts: d.contacts.map((c) =>
            c.id === existing.id
              ? {
                  ...c,
                  phone: input.phone || c.phone,
                  company: input.company || c.company,
                  eventTypeId: input.eventTypeId ?? c.eventTypeId,
                  eventDate: input.eventDate ?? c.eventDate,
                  guestCount: input.guestCount ?? c.guestCount,
                  acknowledgedAt: null,
                }
              : c,
          ),
          activities: [...d.activities, { id: newId('act'), contactId: existing.id, type: 'form_submission', occurredAt: at, summary, createdBy: 'Website form' }],
        };
        if (['prospect', 'lost', 'event_held'].includes(existing.stage)) {
          next = {
            ...next,
            contacts: next.contacts.map((c) => (c.id === existing.id ? { ...c, stage: 'lead' as Stage, lostReason: null, lostReasonNote: '', lostFromStage: null } : c)),
            stageChanges: [...next.stageChanges, { id: newId('sc'), contactId: existing.id, fromStage: existing.stage, toStage: 'lead', changedAt: at, changedBy: 'Website form' }],
          };
        }
        return next;
      }
      const id = resultId;
      const audience: Audience = input.accessibility ? 'accessibility' : (eventType?.defaultAudience ?? 'milestone');
      const contact: Contact = {
        id,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        phone: input.phone.trim(),
        company: input.company.trim(),
        eventTypeId: input.eventTypeId,
        audience,
        eventDate: input.eventDate,
        guestCount: input.guestCount,
        estimatedValue: null,
        source: input.heardFrom,
        ownerId: null,
        tags: input.flexibleDate ? ['Flexible date'] : [],
        stage: 'lead',
        lostReason: null,
        lostReasonNote: '',
        lostFromStage: null,
        createdAt: at,
        reviewRequestedAt: null,
        reviewReceived: false,
        acknowledgedAt: null,
      };
      const extra: Activity[] = input.marketingOptIn
        ? [{ id: newId('act'), contactId: id, type: 'mailchimp_signup', occurredAt: at, summary: 'Ticked “keep me posted” on the enquiry form', createdBy: 'Website form' }]
        : [];
      return {
        ...d,
        contacts: [...d.contacts, contact],
        stageChanges: [...d.stageChanges, { id: newId('sc'), contactId: id, fromStage: null, toStage: 'lead', changedAt: at, changedBy: 'Website form' }],
        activities: [...d.activities, { id: newId('act'), contactId: id, type: 'form_submission', occurredAt: at, summary, createdBy: 'Website form' }, ...extra],
      };
    });
    return resultId;
  }, []);

  const requestReview = useCallback((contactId: string) => {
    setData((d) => ({
      ...d,
      contacts: d.contacts.map((c) => (c.id === contactId ? { ...c, reviewRequestedAt: nowIso() } : c)),
      activities: [...d.activities, activity(contactId, 'review_requested', 'Asked for a Google review')],
    }));
  }, []);

  const resetSampleData = useCallback(() => {
    const fresh = applyAutomaticMoves(generateSampleData());
    setNow(Date.now());
    setData(fresh);
  }, []);

  const value: StoreValue = {
    data,
    insights,
    now,
    addContact,
    updateContact,
    deleteContact,
    moveStage,
    logActivity,
    bookTour,
    setTourStatus,
    rescheduleTour,
    acknowledge,
    bookEvent,
    updateEvent,
    submitEnquiry,
    requestReview,
    resetSampleData,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside <StoreProvider>');
  return v;
}

export function useTeamName() {
  const { data } = useStore();
  return (id: string | null | undefined) => {
    if (!id) return 'Unassigned';
    return data.team.find((m) => m.id === id)?.name ?? id;
  };
}
