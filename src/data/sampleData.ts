// Realistic but entirely made-up data for the phase 2 preview.
// Every date is generated relative to "now", so the preview always looks current.
// Emails use example.com and phone numbers use the ACMA range reserved for fiction.
// This file is deleted in phase 3 when the real database takes over.
import type {
  Activity,
  ActivityType,
  Audience,
  Contact,
  Dataset,
  EventType,
  LostReason,
  Source,
  Stage,
  StageChange,
  TeamMember,
  Tour,
  Proposal,
  TrackingRule,
  VenueEvent,
} from './types';
import { DEFAULT_AGREEMENT_TEMPLATES, DEFAULT_PROPOSAL_TEMPLATES } from '../lib/booking';
import { DEFAULT_RULES } from '../lib/stages';
import { TEMPLATES } from '../lib/templates';

export const SAMPLE_TEAM: TeamMember[] = [
  { id: 'tm-sam', name: 'Sam Porter', email: 'sam@example.com', role: 'admin' },
  { id: 'tm-priya', name: 'Priya Nair', email: 'priya@example.com', role: 'member' },
  { id: 'tm-jordan', name: 'Jordan Reid', email: 'jordan@example.com', role: 'member' },
];

export const EVENT_TYPES: EventType[] = [
  { id: 'milestone_birthday', name: 'Milestone birthday', defaultAudience: 'milestone' },
  { id: 'engagement', name: 'Engagement party', defaultAudience: 'milestone' },
  { id: 'anniversary', name: 'Anniversary', defaultAudience: 'milestone' },
  { id: 'wedding_afterparty', name: 'Wedding after-party', defaultAudience: 'milestone' },
  { id: 'celebration_of_life', name: 'Celebration of life', defaultAudience: 'milestone' },
  { id: 'corporate_eoy', name: 'Corporate EOY / Christmas', defaultAudience: 'corporate' },
  { id: 'corporate_launch', name: 'Corporate milestone / launch', defaultAudience: 'corporate' },
  { id: 'gala', name: 'Small gala / fundraiser', defaultAudience: 'corporate' },
  { id: 'community', name: 'Community / organisation function', defaultAudience: 'milestone' },
  { id: 'other', name: 'Other', defaultAudience: 'milestone' },
];

const FIRST = [
  'Olivia', 'Jack', 'Mia', 'Lachlan', 'Chloe', 'Harrison', 'Grace', 'Tom', 'Zara', 'Nick',
  'Emily', 'Daniel', 'Sophie', 'Marcus', 'Hannah', 'Ben', 'Isla', 'Josh', 'Ruby', 'Alex',
  'Georgia', 'Matt', 'Amelia', 'Luke', 'Ella', 'Sam', 'Lily', 'Riley', 'Charlotte', 'Oscar',
  'Ava', 'Hamish', 'Maddie', 'Kieran', 'Tahlia', 'Will', 'Jess', 'Dylan', 'Freya', 'Connor',
  'Anika', 'Pete', 'Leah', 'Tim', 'Bree', 'Callum', 'Nadia', 'Rhys', 'Holly', 'Ethan',
  'Kate', 'Sean', 'Imogen', 'Aaron', 'Priscilla', 'Jai', 'Mel', 'Hugo', 'Tess', 'Andre',
];
const LAST = [
  'Nguyen', 'Smith', 'Papadopoulos', 'Williams', "O'Brien", 'Tran', 'Brown', 'Kowalski',
  'Wilson', 'Rossi', 'Taylor', 'Singh', 'Martin', 'Anderson', 'Thompson', 'Costa', 'White',
  'Harris', 'Kelly', 'Walker', 'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams',
  'Hill', 'Campbell', 'Mitchell', 'Roberts', 'Carter', 'Phillips', 'Evans', 'Turner',
  'Nikolaidis', 'Parker', 'Collins', 'Edwards', 'Stewart', 'Morris', 'Murphy', 'Cook',
  'Rogers', 'Morgan', 'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kim', 'Bell', 'Ward',
  'Russo', 'Chen', 'Hughes', 'Price', 'Bennett', 'Wood', 'Barnes', 'Ross',
];
const COMPANIES = [
  'Port River Freight', 'Semaphore Dental Group', 'Hindmarsh Legal', 'Birkenhead Build Co',
  'Outer Harbor Engineering', 'Lefevre Accounting', 'Glanville Creative', 'Exeter Physio',
  'Gulf Street Architects', 'Largs Bay Rotary', 'Alberton Community Care', 'Rosewater Tech',
];
// ACMA reserves 0491 570 xxx numbers for fiction, so none of these can ring a real person.
const PHONES = [
  '0491 570 006', '0491 570 156', '0491 570 157', '0491 570 158', '0491 570 159', '0491 570 110',
  '0491 570 313', '0491 570 737', '0491 571 266', '0491 571 491', '0491 571 804', '0491 572 549',
  '0491 572 665', '0491 572 983', '0491 573 770', '0491 573 087', '0491 574 118', '0491 574 632',
];
/** Starting website-tracking rules (edited in Settings → Website tracking). */
export const DEFAULT_TRACKING_RULES: TrackingRule[] = [
  { id: 'tr-weddings', match: '/functions/weddings', tag: 'Browsed: Weddings & after-parties', alert: false },
  { id: 'tr-corporate', match: '/functions/corporate', tag: 'Browsed: Corporate', alert: false },
  { id: 'tr-birthdays', match: '/functions/birthdays', tag: 'Browsed: Milestone birthdays', alert: false },
  { id: 'tr-access', match: '/accessibility', tag: 'Browsed: Accessibility', alert: false },
  { id: 'tr-functions', match: '/functions', tag: 'Browsed: Functions', alert: true },
  { id: 'tr-enquire', match: '/enquire', tag: 'Opened the enquiry page', alert: true },
];

const WEB_PAGES = [
  'Functions › Weddings & after-parties',
  'Functions › Corporate events',
  'Functions › Milestone birthdays',
  'Functions',
  'Gallery',
  'Accessibility',
  'Enquire',
];

const CAMPAIGNS = [
  'Spring celebrations at Confession',
  'Christmas party dates are filling',
  'Your night, the whole church',
  'Now booking autumn weekends',
];

// Small seeded random number generator, so the sample data is the same every time.
function makeRandom(seed: number) {
  let a = seed;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    between: (min: number, max: number) => min + next() * (max - min),
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    pick: <T,>(list: T[]): T => list[Math.floor(next() * list.length)],
    chance: (p: number) => next() < p,
  };
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Round to a sensible business-hours time on the same day (9am to 5pm). */
function businessTime(ms: number, rnd: ReturnType<typeof makeRandom>): number {
  const d = new Date(ms);
  d.setHours(rnd.int(9, 16), rnd.pick([0, 15, 30, 45]), 0, 0);
  return d.getTime();
}

function tourSlot(ms: number, rnd: ReturnType<typeof makeRandom>): number {
  const d = new Date(ms);
  d.setHours(rnd.pick([10, 11, 13, 14, 16, 17]), rnd.pick([0, 30]), 0, 0);
  return d.getTime();
}

const iso = (ms: number) => new Date(ms).toISOString();
const dateOnly = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const niceDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
const niceTime = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });

// How many contacts end up in each stage (60 in total).
const STAGE_MIX: [Stage, number][] = [
  ['prospect', 8],
  ['lead', 9],
  ['tour_booked', 7],
  ['toured', 5],
  ['proposal_sent', 5],
  ['finalising', 3],
  ['confirmed', 7],
  ['event_held', 7],
  ['lost', 9],
];

const LOST_MIX: LostReason[] = [
  'went_quiet', 'went_quiet', 'over_budget', 'chose_another_venue', 'date_unavailable',
  'guest_count_too_large', 'went_quiet', 'over_budget', 'other',
];

// The stage each lost contact had reached before dropping out, matching LOST_MIX.
const LOST_FROM: Stage[] = [
  'tour_booked', 'tour_booked', 'proposal_sent', 'toured', 'lead',
  'lead', 'proposal_sent', 'proposal_sent', 'toured',
];

const VALUE_RANGE: Record<string, [number, number]> = {
  milestone_birthday: [3500, 9000],
  engagement: [4500, 11000],
  anniversary: [3000, 8000],
  wedding_afterparty: [6000, 14000],
  celebration_of_life: [2500, 6000],
  corporate_eoy: [7000, 18000],
  corporate_launch: [5000, 15000],
  gala: [9000, 22000],
  community: [2500, 7000],
  other: [2500, 8000],
};

export function generateSampleData(nowMs: number = Date.now()): Dataset {
  const rnd = makeRandom(1850); // the year the church was built
  const contacts: Contact[] = [];
  const stageChanges: StageChange[] = [];
  const tours: Tour[] = [];
  const events: VenueEvent[] = [];
  const proposals: Proposal[] = [];
  const activities: Activity[] = [];
  let seq = 0;
  const id = (p: string) => `${p}-${++seq}`;

  const act = (contactId: string, type: ActivityType, at: number, summary: string, by: string) => {
    if (at > nowMs) return;
    activities.push({ id: id('act'), contactId, type, occurredAt: iso(at), summary, createdBy: by });
  };
  const move = (contactId: string, from: Stage | null, to: Stage, at: number, by: string) => {
    stageChanges.push({ id: id('sc'), contactId, fromStage: from, toStage: to, changedAt: iso(at), changedBy: by });
  };

  let n = 0;
  for (const [target, count] of STAGE_MIX) {
    for (let k = 0; k < count; k++, n++) {
      const cid = `c-${n + 1}`;
      const owner = SAMPLE_TEAM[n % 3].id;
      const eventType = pickEventType(rnd, target);
      const et = EVENT_TYPES.find((e) => e.id === eventType)!;
      const audience: Audience = rnd.chance(0.14) ? 'accessibility' : et.defaultAudience;
      const lostReason = target === 'lost' ? LOST_MIX[k % LOST_MIX.length] : null;

      let guestCount = rnd.int(35, 145);
      if (lostReason === 'guest_count_too_large') guestCount = 220;
      else if (n === 17 || n === 33) guestCount = n === 17 ? 165 : 180;

      const [lo, hi] = VALUE_RANGE[eventType];
      const value = Math.round(rnd.between(lo, hi) / 250) * 250;

      const firstName = FIRST[n];
      const lastName = LAST[(n * 7) % LAST.length];
      const isCorporate = et.defaultAudience === 'corporate' || eventType === 'community';
      const source: Source =
        target === 'prospect'
          ? rnd.pick<Source>(['mailchimp_signup', 'mailchimp_signup', 'instagram', 'wedding_expo'])
          : rnd.pick<Source>([
              'website_form', 'website_form', 'website_form', 'google', 'google',
              'instagram', 'instagram', 'referral', 'referral', 'wedding_expo',
              'mailchimp_signup', 'other',
            ]);

      // Journey timings (in ms after the enquiry).
      const replyAfter = rnd.chance(0.8) ? rnd.between(0.5, 7) * HOUR : rnd.between(20, 40) * HOUR;
      const bookAfter = replyAfter + rnd.between(0.5, 4) * DAY;
      const tourAfter = bookAfter + rnd.between(3, 14) * DAY;
      const proposalAfter = tourAfter + (rnd.chance(0.75) ? rnd.between(16, 46) : rnd.between(50, 90)) * HOUR;
      const acceptAfter = proposalAfter + rnd.between(2, 10) * DAY;
      const confirmAfter = acceptAfter + rnd.between(3, 10) * DAY;

      // Decide when the enquiry arrived so each contact is at the right point today.
      let enquiredAt: number;
      let tourAt: number | null = null;
      switch (target) {
        case 'prospect':
          // Two brand-new signups this week, the rest spread over recent months.
          enquiredAt = nowMs - (k < 2 ? rnd.between(0.3, 3) : rnd.between(8, 170)) * DAY;
          break;
        case 'lead':
          // A few fresh ones, a few waiting too long for a reply, some needing a follow-up.
          enquiredAt =
            k < 2 ? nowMs - rnd.between(2, 9) * HOUR : k < 4 ? nowMs - rnd.between(27, 40) * HOUR : nowMs - rnd.between(3, 12) * DAY;
          break;
        case 'tour_booked':
          // The first two had their tour recently but nobody has marked the outcome yet.
          enquiredAt = nowMs - bookAfter - (k < 2 ? rnd.between(3, 5) : rnd.between(0.2, 3)) * DAY;
          tourAt =
            k < 2
              ? tourSlot(nowMs - DAY * (k + 1), rnd)
              : tourSlot(nowMs + (k === 2 ? 0 : rnd.between(1, 12)) * DAY, rnd);
          if (tourAt < nowMs && k >= 2) tourAt += DAY;
          break;
        case 'toured':
          enquiredAt = nowMs - tourAfter - rnd.between(0.3, 5) * DAY;
          break;
        case 'proposal_sent':
          enquiredAt = nowMs - proposalAfter - rnd.between(0.5, 13) * DAY;
          break;
        case 'finalising':
          // Accepted a few days ago; paperwork part-way through.
          enquiredAt = nowMs - acceptAfter - rnd.between(2, 6) * DAY;
          break;
        case 'confirmed':
          // A few confirmed in the last month, the rest earlier.
          enquiredAt = nowMs - confirmAfter - (k < 3 ? rnd.between(1, 25) : rnd.between(30, 150)) * DAY;
          break;
        case 'event_held':
          enquiredAt = nowMs - confirmAfter - rnd.between(40, 200) * DAY;
          break;
        default: // lost
          enquiredAt = nowMs - rnd.between(12, 260) * DAY;
      }
      // Keep brand-new enquiries exact; round the rest to business hours.
      if (!(target === 'lead' && k < 2)) enquiredAt = businessTime(enquiredAt, rnd);
      if (enquiredAt > nowMs) enquiredAt -= DAY;

      // Prospects who later enquired signed up to the mailing list first.
      const startedAsProspect = target === 'prospect' || source === 'mailchimp_signup';
      const createdAt = startedAsProspect && target !== 'prospect' ? enquiredAt - rnd.between(10, 90) * DAY : enquiredAt;

      // Event date: well after the enquiry, and in the past only for held events.
      let eventDateMs: number | null = null;
      if (target === 'event_held') {
        eventDateMs = Math.min(enquiredAt + confirmAfter + rnd.between(20, 120) * DAY, nowMs - rnd.between(2, 40) * DAY);
      } else if (target !== 'prospect') {
        eventDateMs = Math.max(nowMs + rnd.between(14, 220) * DAY, enquiredAt + rnd.between(60, 240) * DAY);
      } else if (rnd.chance(0.3)) {
        eventDateMs = nowMs + rnd.between(60, 300) * DAY;
      }
      if (eventDateMs) {
        // Most celebrations land on a Friday or Saturday; corporate events more often midweek.
        const d = new Date(eventDateMs);
        const wantDay = isCorporate ? rnd.pick([3, 4, 5, 5]) : rnd.pick([5, 6, 6, 6, 0]);
        d.setDate(d.getDate() + ((wantDay - d.getDay() + 7) % 7));
        eventDateMs = d.getTime();
        if (target === 'event_held' && eventDateMs > nowMs - DAY) eventDateMs -= 7 * DAY;
      }

      const tags: string[] = [];
      if (rnd.chance(0.18) && target !== 'lost') tags.push('Hot');
      if (rnd.chance(0.1)) tags.push('Repeat client');
      if (source === 'referral' && rnd.chance(0.5)) tags.push('Referral partner');
      if (rnd.chance(0.12)) tags.push('Flexible date');

      const contact: Contact = {
        id: cid,
        firstName,
        lastName,
        email: `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.com',
        phone: target === 'prospect' && rnd.chance(0.6) ? '' : PHONES[n % PHONES.length],
        company: isCorporate ? COMPANIES[n % COMPANIES.length] : '',
        eventTypeId: target === 'prospect' && rnd.chance(0.5) ? null : eventType,
        audience,
        eventDate: eventDateMs ? dateOnly(eventDateMs) : null,
        guestCount: target === 'prospect' ? null : guestCount,
        estimatedValue: target === 'prospect' ? null : value,
        source,
        ownerId: owner,
        tags,
        stage: target,
        lostReason,
        lostReasonNote: lostReason === 'other' ? 'Postponed indefinitely, family overseas' : '',
        lostFromStage: null,
        createdAt: iso(createdAt),
        reviewRequestedAt: null,
        reviewReceived: false,
        acknowledgedAt: null,
        accessibilityNeeds:
          audience === 'accessibility'
            ? rnd.pick([
                'Two guests use wheelchairs, and my aunt is Deaf so we may need an Auslan interpreter for speeches',
                'My son uses a power chair and needs space to move around the dance floor',
                'A few guests have low vision, so large-print menus would help',
              ])
            : '',
        marketingConsent:
          source === 'mailchimp_signup' || target === 'prospect'
            ? 'subscribed'
            : rnd.chance(0.08)
              ? 'unsubscribed'
              : rnd.chance(0.45)
                ? 'subscribed'
                : 'not_subscribed',
      };
      contacts.push(contact);

      // ---- Build the history ----
      const etName = et.name;
      if (startedAsProspect) {
        move(cid, null, 'prospect', createdAt, source === 'mailchimp_signup' ? 'Mailchimp sync' : owner);
        act(cid, 'mailchimp_signup', createdAt, 'Joined the Confession mailing list', 'Mailchimp sync');
      }
      if (target === 'prospect') {
        addEdm(cid, createdAt);
        addWebVisits(cid, createdAt, k < 3);
        continue;
      }

      move(cid, startedAsProspect ? 'prospect' : null, 'lead', enquiredAt, 'Website form');
      act(cid, 'form_submission', enquiredAt, enquirySummary(source, etName, guestCount), 'Website form');

      // Leads: some replied, some still waiting.
      const leadWaiting = target === 'lead' && k < 4;
      if (!leadWaiting) {
        act(cid, 'email_out', enquiredAt + replyAfter, 'Re: your enquiry. Tour times this week', owner);
      }
      if (target === 'lead') {
        if (k >= 4 && k % 2 === 0) act(cid, 'email_in', enquiredAt + replyAfter + 5 * HOUR, 'Thanks! Checking dates with my partner', 'Gmail sync');
        addEdm(cid, enquiredAt);
        addWebVisits(cid, enquiredAt, k === 5 || k === 7);
        continue;
      }

      // Lost contacts stop somewhere along the way.
      const lostFrom: Stage | null = target === 'lost' ? LOST_FROM[k % LOST_FROM.length] : null;
      const reaches = (s: Stage) =>
        target === 'lost' ? order(lostFrom!) >= order(s) : order(target) >= order(s);

      let lastStep = enquiredAt + replyAfter;
      let current: Stage = 'lead';

      if (reaches('tour_booked')) {
        const bookedAt = enquiredAt + bookAfter;
        const scheduled = tourAt ?? tourSlot(enquiredAt + tourAfter, rnd);
        const noShow = target === 'lost' && lostFrom === 'tour_booked';
        tours.push({
          id: id('tour'),
          contactId: cid,
          scheduledFor: iso(scheduled),
          bookedAt: iso(bookedAt),
          status: target === 'tour_booked' ? 'booked' : noShow ? 'no_show' : 'attended',
          hostId: owner,
          notes: '',
        });
        move(cid, current, 'tour_booked', bookedAt, owner);
        current = 'tour_booked';
        act(cid, 'tour_booked', bookedAt, `Tour booked for ${niceDate(scheduled)}, ${niceTime(scheduled)}`, owner);
        lastStep = bookedAt;
        if (noShow) {
          act(cid, 'tour_no_show', scheduled + HOUR, 'Didn’t make it to the tour', owner);
          act(cid, 'call', scheduled + DAY, 'Left a voicemail to rebook the tour', owner);
          lastStep = scheduled + DAY;
        }
        if (reaches('toured') && !noShow) {
          move(cid, current, 'toured', scheduled + HOUR, owner);
          current = 'toured';
          act(cid, 'tour_attended', scheduled + HOUR, 'Tour attended', owner);
          act(cid, 'note', scheduled + 1.5 * HOUR, rnd.pick(TOUR_NOTES), owner);
          lastStep = scheduled + HOUR;
        }
      }

      if (reaches('proposal_sent')) {
        const at = enquiredAt + proposalAfter;
        move(cid, current, 'proposal_sent', at, owner);
        current = 'proposal_sent';
        act(cid, 'proposal_sent', at, `Proposal sent for ${etName}, ${guestCount} guests`, owner);
        lastStep = at;
        const tpl = DEFAULT_PROPOSAL_TEMPLATES.find((t) => t.audience === audience) ?? DEFAULT_PROPOSAL_TEMPLATES[0];
        const accepted = reaches('finalising');
        proposals.push({
          id: id('prop'),
          contactId: cid,
          templateId: tpl.id,
          headline: tpl.headline,
          intro: tpl.intro,
          inclusions: tpl.inclusions,
          nextSteps: tpl.nextSteps,
          lines: [{ label: 'Venue hire and package', amount: value }],
          status: accepted ? 'accepted' : 'sent',
          createdAt: iso(at - HOUR),
          sentAt: iso(at),
          acceptedAt: accepted ? iso(Math.min(enquiredAt + acceptAfter, nowMs)) : null,
        });
        if (target === 'proposal_sent' && rnd.chance(0.5)) {
          act(cid, 'email_in', at + rnd.between(1, 3) * DAY, 'Question about styling and bump-in times', 'Gmail sync');
        }
      }

      // Paperwork times for anyone who accepted.
      const acceptedAt = enquiredAt + acceptAfter;
      const agreementSentAt = acceptedAt + 0.3 * DAY;
      const agreementSignedAt = agreementSentAt + 0.5 * DAY;
      const invoiceSentAt = agreementSignedAt + 0.3 * DAY;
      if (reaches('finalising')) {
        act(cid, 'call', enquiredAt + proposalAfter + (acceptAfter - proposalAfter) / 2, 'Follow-up call on the proposal', owner);
        move(cid, current, 'finalising', acceptedAt, owner);
        current = 'finalising';
        act(cid, 'proposal_accepted', acceptedAt, 'Accepted the proposal', owner);
        lastStep = acceptedAt;
        const paperwork = target === 'finalising' ? k : 3; // 0 sent · 1 signed · 2 invoiced · 3 paid
        act(cid, 'agreement_sent', agreementSentAt, 'Hire agreement sent for e-signature', owner);
        if (paperwork >= 1) act(cid, 'agreement_signed', agreementSignedAt, `Signed by ${firstName} ${lastName}`, 'Client (e-signature)');
        if (paperwork >= 2) act(cid, 'invoice_sent', invoiceSentAt, `Deposit invoice sent (${value.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })})`, owner);
      }

      if (reaches('confirmed')) {
        const at = enquiredAt + confirmAfter;
        move(cid, current, 'confirmed', at, owner);
        current = 'confirmed';
        act(cid, 'deposit_paid', at, 'Deposit received. The event is live', owner);
        lastStep = at;
      }

      // Booked functions go on the calendar. Two proposals have the date pencilled in.
      if (eventDateMs && (target === 'confirmed' || target === 'event_held' || target === 'finalising' || (target === 'proposal_sent' && k < 2))) {
        const corporateNight = isCorporate && new Date(eventDateMs).getDay() >= 1 && new Date(eventDateMs).getDay() <= 4;
        events.push({
          id: id('ev'),
          contactId: cid,
          date: dateOnly(eventDateMs),
          startTime: corporateNight ? '17:30' : rnd.pick(['18:00', '18:30', '19:00']),
          endTime: corporateNight ? '22:30' : rnd.pick(['23:00', '23:30', '00:00']),
          space: guestCount > 150 ? 'altar_room_plus' : 'altar_room',
          guestCount,
          status: target === 'proposal_sent' || target === 'finalising' ? 'hold' : 'confirmed',
          notes: '',
          createdAt: iso(Math.min(enquiredAt + (target === 'proposal_sent' ? proposalAfter : acceptAfter), nowMs)),
        });
        const ev = events[events.length - 1];
        if (target !== 'proposal_sent') {
          const paperwork = target === 'finalising' ? k : 3;
          ev.agreementTemplateId = DEFAULT_AGREEMENT_TEMPLATES[0].id;
          ev.agreementSentAt = iso(agreementSentAt);
          ev.agreementSignedAt = paperwork >= 1 ? iso(agreementSignedAt) : null;
          ev.signedName = paperwork >= 1 ? `${firstName} ${lastName}` : '';
          ev.depositAmount = value;
          ev.depositInvoiceSentAt = paperwork >= 2 ? iso(invoiceSentAt) : null;
          ev.depositPaidAt = paperwork >= 3 ? iso(enquiredAt + confirmAfter) : null;
        }
      }

      if (target === 'event_held' && eventDateMs) {
        const heldAt = eventDateMs + DAY;
        move(cid, current, 'event_held', heldAt, 'Automatic');
        if (rnd.chance(0.6)) {
          const reqAt = heldAt + rnd.between(2, 6) * DAY;
          if (reqAt < nowMs) {
            contact.reviewRequestedAt = iso(reqAt);
            contact.reviewReceived = rnd.chance(0.5);
            act(cid, 'review_requested', reqAt, 'Asked for a Google review', owner);
          }
        }
      }

      if (target === 'lost') {
        const lostAt = Math.min(lastStep + rnd.between(4, 20) * DAY, nowMs - DAY);
        move(cid, current, 'lost', lostAt, owner);
        contact.lostFromStage = current;
        act(cid, 'note', lostAt, lostNote(lostReason!), owner);
      }

      addEdm(cid, createdAt);
      addWebVisits(cid, createdAt, target === 'proposal_sent' && k === 2);
    }
  }

  // Pages people looked at on the Confession website after they were known to us.
  function addWebVisits(cid: string, since: number, recent: boolean) {
    if (!recent && !rnd.chance(0.3)) return;
    const visits = recent ? rnd.int(1, 2) : rnd.int(1, 3);
    for (let i = 0; i < visits; i++) {
      const at = recent ? nowMs - rnd.between(0.2, 6) * DAY : Math.min(since + rnd.between(1, 50) * DAY, nowMs - DAY);
      if (at < since) continue;
      const pages = [rnd.pick(WEB_PAGES), rnd.pick(WEB_PAGES)].filter((v, n, a) => a.indexOf(v) === n);
      act(cid, 'web_visit', at, `Viewed ${pages.length + rnd.int(0, 3)} pages, including ${pages.join(' and ')}`, 'Website tracking');
    }
  }

  function addEdm(cid: string, since: number) {
    if (!rnd.chance(0.45)) return;
    const sends = rnd.int(1, 3);
    for (let i = 0; i < sends; i++) {
      const at = businessTime(since + rnd.between(2, 60) * DAY, rnd);
      const campaign = rnd.pick(CAMPAIGNS);
      act(cid, 'edm_open', at, `Opened: ${campaign}`, 'Mailchimp sync');
      if (rnd.chance(0.35)) act(cid, 'edm_click', at + 120_000, `Clicked “Book a tour” in: ${campaign}`, 'Mailchimp sync');
    }
  }

  // One event per date: nudge any sample clash along by a week.
  const taken = new Set<string>();
  for (const ev of events.sort((a, b) => a.date.localeCompare(b.date))) {
    let d = new Date(ev.date + 'T12:00:00');
    const step = d.getTime() < nowMs ? -7 * DAY : 7 * DAY; // keep past events in the past
    while (taken.has(dateOnly(d.getTime()))) d = new Date(d.getTime() + step);
    ev.date = dateOnly(d.getTime());
    taken.add(ev.date);
    const c = contacts.find((x) => x.id === ev.contactId);
    if (c) c.eventDate = ev.date;
  }

  return {
    team: SAMPLE_TEAM,
    eventTypes: EVENT_TYPES,
    contacts,
    stageChanges,
    tours,
    events,
    activities,
    rules: { ...DEFAULT_RULES },
    templates: TEMPLATES.map((t) => ({ ...t })),
    trackingRules: DEFAULT_TRACKING_RULES.map((r) => ({ ...r })),
    proposals,
    proposalTemplates: DEFAULT_PROPOSAL_TEMPLATES.map((t) => ({ ...t })),
    agreementTemplates: DEFAULT_AGREEMENT_TEMPLATES.map((t) => ({ ...t })),
  };
}

function order(s: Stage): number {
  return ['prospect', 'lead', 'tour_booked', 'toured', 'proposal_sent', 'finalising', 'confirmed', 'event_held'].indexOf(s);
}

function pickEventType(rnd: ReturnType<typeof makeRandom>, stage: Stage): string {
  const weighted = [
    'milestone_birthday', 'milestone_birthday', 'milestone_birthday', 'engagement', 'engagement',
    'wedding_afterparty', 'wedding_afterparty', 'anniversary', 'corporate_eoy', 'corporate_eoy',
    'corporate_eoy', 'corporate_launch', 'gala', 'celebration_of_life', 'community', 'other',
  ];
  return stage === 'prospect' ? rnd.pick(weighted.slice(0, 8)) : rnd.pick(weighted);
}

function enquirySummary(source: Source, eventType: string, guests: number): string {
  const what = `${eventType.toLowerCase()}, about ${guests} guests`;
  switch (source) {
    case 'instagram':
      return `Instagram DM: ${what}`;
    case 'referral':
      return `Referral enquiry: ${what}`;
    case 'wedding_expo':
      return `Wedding expo card: ${what}`;
    case 'other':
      return `Phone enquiry: ${what}`;
    default:
      return `Website enquiry form: ${what}`;
  }
}

function lostNote(reason: LostReason): string {
  switch (reason) {
    case 'went_quiet':
      return 'No reply after three follow-ups. Archived, stays on the EDM list';
    case 'over_budget':
      return 'Loved the space but the proposal was over their budget';
    case 'chose_another_venue':
      return 'Went with a venue closer to the city';
    case 'date_unavailable':
      return 'Their only date was already booked';
    case 'guest_count_too_large':
      return '220 guests, too many even with the second room';
    default:
      return 'Event postponed indefinitely';
  }
}

const TOUR_NOTES = [
  'Loved the Altar Room. Bringing their mum back for a second look',
  'Asked about the accessible dance floor and lowered bar. Very keen',
  'Wants a DJ and grazing tables. Flexible on Friday or Saturday',
  'Corporate buyer, needs the proposal for sign-off by the end of the week',
  'Asked about bump-in times for their stylist',
  'Partner came too. Both picturing the first dance under the lights',
];
