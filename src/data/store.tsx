// The dashboard's data and every action that changes it.
// Phase 2: sample data, saved in this browser only.
// Phase 3: the same actions will read and write Supabase instead.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { generateSampleData } from './sampleData';
import type { Activity, ActivityType, Contact, Dataset, LostReason, Stage, Tour, TourStatus } from './types';
import { buildInsights, type Insight } from '../lib/metrics';

const STORAGE_KEY = 'confession-dashboard-sample-v2';
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
