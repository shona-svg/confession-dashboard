// The calculations behind the dashboard and reports. Everything here is a plain
// function of the data, so the numbers are the same whether they come from
// sample data or the real database.
import type { Audience, Contact, Dataset, LostReason, Source, Stage, Tour } from '../data/types';
import {
  AUDIENCES,
  CONTACT_TYPES,
  JOURNEY,
  LOST_REASONS,
  OPEN_STAGES,
  REPLY_TYPES,
  RULES,
  SOURCES,
  stageIndex,
} from './stages';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const t = (iso: string) => new Date(iso).getTime();

/** Facts worked out for each contact from their history. */
export interface Insight {
  contact: Contact;
  enquiredAt: number | null; // when they became a Lead
  firstReplyAt: number | null;
  lastContactAt: number | null;
  lastContactSummary: string;
  highestIndex: number; // furthest point in the journey ever reached
  reachedAt: Partial<Record<Stage, number>>;
  tours: Tour[];
  nextTour: Tour | null;
  lastAttendedTourAt: number | null;
  isOpen: boolean;
  awaitingReply: boolean;
  replyOverdue: boolean;
  proposalOverdue: boolean;
  followUpDue: boolean;
  daysSinceContact: number | null;
  overCapacity: boolean;
}

export function buildInsights(data: Dataset, now = Date.now()): Map<string, Insight> {
  const byContact = new Map<string, Insight>();
  for (const c of data.contacts) {
    byContact.set(c.id, {
      contact: c,
      enquiredAt: null,
      firstReplyAt: null,
      lastContactAt: null,
      lastContactSummary: '',
      highestIndex: c.stage === 'lost' ? -1 : stageIndex(c.stage),
      reachedAt: {},
      tours: [],
      nextTour: null,
      lastAttendedTourAt: null,
      isOpen: OPEN_STAGES.includes(c.stage),
      awaitingReply: false,
      replyOverdue: false,
      proposalOverdue: false,
      followUpDue: false,
      daysSinceContact: null,
      overCapacity: (c.guestCount ?? 0) > RULES.altarRoomCapacity,
    });
  }

  for (const sc of data.stageChanges) {
    const i = byContact.get(sc.contactId);
    if (!i) continue;
    const at = t(sc.changedAt);
    if (i.reachedAt[sc.toStage] === undefined || at < i.reachedAt[sc.toStage]!) i.reachedAt[sc.toStage] = at;
    if (sc.toStage !== 'lost') i.highestIndex = Math.max(i.highestIndex, stageIndex(sc.toStage));
  }

  for (const tour of data.tours) {
    const i = byContact.get(tour.contactId);
    if (!i) continue;
    i.tours.push(tour);
    if (tour.status === 'attended') {
      i.lastAttendedTourAt = Math.max(i.lastAttendedTourAt ?? 0, t(tour.scheduledFor));
    }
  }

  const sorted = [...data.activities].sort((a, b) => t(a.occurredAt) - t(b.occurredAt));
  for (const i of byContact.values()) {
    i.enquiredAt = i.reachedAt.lead ?? (i.highestIndex >= 1 ? t(i.contact.createdAt) : null);
    i.tours.sort((a, b) => t(a.scheduledFor) - t(b.scheduledFor));
    i.nextTour = i.tours.find((x) => x.status === 'booked') ?? null;
  }
  for (const a of sorted) {
    const i = byContact.get(a.contactId);
    if (!i) continue;
    const at = t(a.occurredAt);
    if (REPLY_TYPES.includes(a.type) && i.enquiredAt !== null && at >= i.enquiredAt && i.firstReplyAt === null) {
      i.firstReplyAt = at;
    }
    if (CONTACT_TYPES.includes(a.type)) {
      i.lastContactAt = at;
      i.lastContactSummary = a.summary;
    }
  }

  for (const i of byContact.values()) {
    const c = i.contact;
    const lastTouch = Math.max(i.lastContactAt ?? 0, i.enquiredAt ?? 0) || null;
    i.daysSinceContact = lastTouch ? Math.floor((now - lastTouch) / DAY) : null;
    if (i.isOpen) {
      i.awaitingReply = i.enquiredAt !== null && i.firstReplyAt === null;
      i.replyOverdue = i.awaitingReply && now - i.enquiredAt! > RULES.replyWithinHours * HOUR;
      i.followUpDue = (i.daysSinceContact ?? 0) >= RULES.followUpDays;
      i.proposalOverdue =
        c.stage === 'toured' &&
        i.lastAttendedTourAt !== null &&
        now - i.lastAttendedTourAt > RULES.proposalWithinHours * HOUR;
    }
  }
  return byContact;
}

// ---------- Date ranges ----------

export type RangeKey = '30d' | '90d' | '6m' | 'all';
export const RANGES: { id: RangeKey; label: string }[] = [
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: '6m', label: '6 months' },
  { id: 'all', label: 'All time' },
];

export interface Range {
  from: number; // inclusive
  to: number; // exclusive
}

export function rangeFor(key: RangeKey, now = Date.now()): Range {
  const d = new Date(now);
  switch (key) {
    case '30d':
      return { from: now - 30 * DAY, to: now + 1 };
    case '90d':
      return { from: now - 90 * DAY, to: now + 1 };
    case '6m':
      d.setMonth(d.getMonth() - 6);
      return { from: d.getTime(), to: now + 1 };
    default:
      return { from: 0, to: now + 1 };
  }
}

const inRange = (ms: number | null | undefined, r: Range) => ms != null && ms >= r.from && ms < r.to;

// ---------- Home ----------

export function startOfWeek(now = Date.now()): number {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function homeStats(data: Dataset, insights: Map<string, Insight>, now = Date.now()) {
  const all = [...insights.values()];
  const weekStart = startOfWeek(now);
  const newEnquiries = all.filter((i) => inRange(i.enquiredAt, { from: weekStart, to: now + 1 }));
  const upcomingTours = data.tours.filter(
    (x) => x.status === 'booked' && t(x.scheduledFor) >= now && t(x.scheduledFor) < now + 7 * DAY,
  );
  const open = all.filter((i) => i.isOpen);
  const confirmedRecently = all.filter((i) => inRange(i.reachedAt.confirmed, { from: now - 30 * DAY, to: now + 1 }));
  return {
    newEnquiries: newEnquiries.length,
    toursNext7: upcomingTours.length,
    openCount: open.length,
    openValue: sum(open.map((i) => i.contact.estimatedValue)),
    confirmed30: confirmedRecently.length,
    confirmed30Value: sum(confirmedRecently.map((i) => i.contact.estimatedValue)),
  };
}

// ---------- Reports ----------

export interface FunnelStep {
  stage: Stage;
  count: number;
  fromPrevious: number | null; // conversion from the step before, 0..1
}

/**
 * Contacts who enquired in the range, and how far along the journey they've got.
 * Anyone who skipped a stage still counts as having passed through it.
 */
export function funnel(insights: Map<string, Insight>, r: Range) {
  const cohort = [...insights.values()].filter((i) => inRange(i.enquiredAt, r));
  const steps: FunnelStep[] = JOURNEY.slice(1).map((stage, n, list) => {
    const idx = stageIndex(stage);
    const count = cohort.filter((i) => i.highestIndex >= idx).length;
    const prevIdx = n === 0 ? null : stageIndex(list[n - 1]);
    const prevCount = prevIdx === null ? null : cohort.filter((i) => i.highestIndex >= prevIdx).length;
    return { stage, count, fromPrevious: prevCount ? count / prevCount : prevCount === 0 ? 0 : null };
  });
  const prospects = [...insights.values()].filter(
    (i) => i.reachedAt.prospect !== undefined && inRange(i.reachedAt.prospect, r),
  );
  const prospectsConverted = prospects.filter((i) => i.highestIndex >= 1).length;
  const lost = cohort.filter((i) => i.contact.stage === 'lost').length;
  return { steps, prospects: prospects.length, prospectsConverted, lost, cohortSize: cohort.length };
}

export interface WeekBucket {
  start: number;
  enquiries: number;
  toursBooked: number;
}

export function weekly(data: Dataset, insights: Map<string, Insight>, r: Range, now = Date.now()): WeekBucket[] {
  const enquiryTimes = [...insights.values()].map((i) => i.enquiredAt).filter((x): x is number => x !== null);
  const earliest = r.from > 0 ? r.from : Math.min(...enquiryTimes, now);
  const buckets: WeekBucket[] = [];
  for (let s = startOfWeek(earliest); s < now; s += 7 * DAY) {
    buckets.push({ start: s, enquiries: 0, toursBooked: 0 });
  }
  const place = (ms: number) => {
    if (!inRange(ms, r)) return null;
    const idx = Math.floor((startOfWeek(ms) - buckets[0].start) / (7 * DAY) + 0.01);
    return buckets[idx] ?? null;
  };
  for (const ms of enquiryTimes) {
    const b = place(ms);
    if (b) b.enquiries++;
  }
  for (const tour of data.tours) {
    const b = place(t(tour.bookedAt));
    if (b) b.toursBooked++;
  }
  return buckets;
}

export interface SegmentRow {
  key: string;
  label: string;
  newContacts: number;
  enquiries: number;
  tours: number;
  confirmed: number;
  conversion: number | null;
  confirmedValue: number;
  pipelineValue: number;
  avgGuests: number | null;
}

function segmentRows<K extends string>(
  insights: Map<string, Insight>,
  r: Range,
  keys: { id: K; label: string }[],
  keyOf: (c: Contact) => K | null,
): SegmentRow[] {
  const all = [...insights.values()];
  const confirmedIdx = stageIndex('confirmed');
  return keys.map(({ id, label }) => {
    const mine = all.filter((i) => keyOf(i.contact) === id);
    const enquiries = mine.filter((i) => inRange(i.enquiredAt, r));
    const confirmed = enquiries.filter((i) => i.highestIndex >= confirmedIdx && i.contact.stage !== 'lost');
    const guests = enquiries.map((i) => i.contact.guestCount).filter((g): g is number => g !== null);
    return {
      key: id,
      label,
      newContacts: mine.filter((i) => inRange(t(i.contact.createdAt), r)).length,
      enquiries: enquiries.length,
      tours: enquiries.filter((i) => i.tours.length > 0).length,
      confirmed: confirmed.length,
      conversion: enquiries.length ? confirmed.length / enquiries.length : null,
      confirmedValue: sum(confirmed.map((i) => i.contact.estimatedValue)),
      pipelineValue: sum(enquiries.filter((i) => i.isOpen).map((i) => i.contact.estimatedValue)),
      avgGuests: guests.length ? Math.round(guests.reduce((a, b) => a + b, 0) / guests.length) : null,
    };
  });
}

export const bySource = (ins: Map<string, Insight>, r: Range) =>
  segmentRows<Source>(ins, r, SOURCES, (c) => c.source);

export const byAudience = (ins: Map<string, Insight>, r: Range) =>
  segmentRows<Audience>(ins, r, AUDIENCES, (c) => c.audience);

export const byEventType = (data: Dataset, ins: Map<string, Insight>, r: Range) =>
  segmentRows<string>(
    ins,
    r,
    data.eventTypes.map((e) => ({ id: e.id, label: e.name })),
    (c) => c.eventTypeId,
  );

export function speed(insights: Map<string, Insight>, r: Range) {
  const cohort = [...insights.values()].filter((i) => inRange(i.enquiredAt, r));
  const replyHours = cohort
    .filter((i) => i.firstReplyAt !== null)
    .map((i) => (i.firstReplyAt! - i.enquiredAt!) / HOUR);
  const enquiryToTourDays = cohort
    .filter((i) => i.tours.length)
    .map((i) => (t(i.tours[0].scheduledFor) - i.enquiredAt!) / DAY);
  const tourToProposalHours = cohort
    .filter((i) => i.lastAttendedTourAt !== null && i.reachedAt.proposal_sent !== undefined)
    .map((i) => {
      const firstAttended = i.tours.find((x) => x.status === 'attended');
      return (i.reachedAt.proposal_sent! - t(firstAttended!.scheduledFor)) / HOUR;
    })
    .filter((h) => h >= 0);
  const tourToConfirmedDays = cohort
    .filter((i) => i.reachedAt.confirmed !== undefined && i.tours.some((x) => x.status === 'attended'))
    .map((i) => (i.reachedAt.confirmed! - t(i.tours.find((x) => x.status === 'attended')!.scheduledFor)) / DAY)
    .filter((d) => d >= 0);
  return {
    firstReplyHours: avg(replyHours),
    repliedWithin24: replyHours.length
      ? replyHours.filter((h) => h <= RULES.replyWithinHours).length / replyHours.length
      : null,
    replySample: replyHours.length,
    enquiryToTourDays: avg(enquiryToTourDays),
    tourToProposalHours: avg(tourToProposalHours),
    proposalWithin48: tourToProposalHours.length
      ? tourToProposalHours.filter((h) => h <= RULES.proposalWithinHours).length / tourToProposalHours.length
      : null,
    tourToConfirmedDays: avg(tourToConfirmedDays),
  };
}

export function tourStats(data: Dataset, insights: Map<string, Insight>, r: Range, now = Date.now()) {
  const bookedInRange = data.tours.filter((x) => inRange(t(x.bookedAt), r));
  const leadDays = bookedInRange.map((x) => (t(x.scheduledFor) - t(x.bookedAt)) / DAY);
  const happened = data.tours.filter((x) => inRange(t(x.scheduledFor), r) && t(x.scheduledFor) < now);
  const attended = happened.filter((x) => x.status === 'attended');
  const noShow = happened.filter((x) => x.status === 'no_show');
  const cancelled = happened.filter((x) => x.status === 'cancelled');
  const unmarked = happened.filter((x) => x.status === 'booked');
  const confirmedIdx = stageIndex('confirmed');
  const converted = attended.filter((x) => {
    const i = insights.get(x.contactId);
    return i && i.highestIndex >= confirmedIdx && i.contact.stage !== 'lost';
  });
  const outcomeKnown = attended.length + noShow.length;
  return {
    booked: bookedInRange.length,
    bookingToTourDays: avg(leadDays),
    attended: attended.length,
    noShow: noShow.length,
    cancelled: cancelled.length,
    unmarked: unmarked.length,
    noShowRate: outcomeKnown ? noShow.length / outcomeKnown : null,
    tourToBooking: attended.length ? converted.length / attended.length : null,
  };
}

export function lostReasons(insights: Map<string, Insight>, r: Range) {
  const lost = [...insights.values()].filter((i) => i.contact.stage === 'lost' && inRange(i.reachedAt.lost, r));
  return {
    total: lost.length,
    rows: LOST_REASONS.map(({ id, label }) => ({
      id: id as LostReason,
      label,
      count: lost.filter((i) => i.contact.lostReason === id).length,
    })),
  };
}

/** Weekend = Friday, Saturday or Sunday event date. */
export function weekdayWeekend(insights: Map<string, Insight>, r: Range) {
  const won = [...insights.values()].filter(
    (i) => inRange(i.reachedAt.confirmed, r) && i.contact.stage !== 'lost' && i.contact.eventDate,
  );
  const weekend = won.filter((i) => [0, 5, 6].includes(new Date(i.contact.eventDate + 'T12:00:00').getDay()));
  return { weekend: weekend.length, weekday: won.length - weekend.length };
}

// ---------- helpers ----------

export function sum(values: (number | null | undefined)[]): number {
  return values.reduce<number>((a, b) => a + (b ?? 0), 0);
}

function avg(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
