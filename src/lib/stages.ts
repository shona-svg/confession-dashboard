// Every rule about stages, statuses, sources and lost reasons lives here, so a
// change of wording or order only needs to happen in one place.
import type { ActivityType, Audience, LostReason, Rules, Source, Stage, Status } from '../data/types';

/** The journey in order. Lost sits outside the order. */
export const JOURNEY: Stage[] = [
  'prospect',
  'lead',
  'tour_booked',
  'toured',
  'proposal_sent',
  'confirmed',
  'event_held',
];

export const ALL_STAGES: Stage[] = [...JOURNEY, 'lost'];

export const STAGE_LABEL: Record<Stage, string> = {
  prospect: 'Prospect',
  lead: 'Lead',
  tour_booked: 'Tour booked',
  toured: 'Toured',
  proposal_sent: 'Proposal sent',
  confirmed: 'Confirmed',
  event_held: 'Event held',
  lost: 'Lost',
};

export const STAGE_HINT: Record<Stage, string> = {
  prospect: 'Showed interest, no event details yet',
  lead: 'Enquired about a specific event',
  tour_booked: 'Tour time locked in',
  toured: 'Walked through the venue',
  proposal_sent: 'Custom proposal with pricing sent',
  confirmed: 'Deposit paid, date locked',
  event_held: 'The night has happened',
  lost: 'Not going ahead',
};

/** Open means "still in play and needs the team's attention". */
export const OPEN_STAGES: Stage[] = ['lead', 'tour_booked', 'toured', 'proposal_sent'];
export const WON_STAGES: Stage[] = ['confirmed', 'event_held'];

export function stageIndex(stage: Stage): number {
  return JOURNEY.indexOf(stage);
}

export function statusOf(stage: Stage): Status {
  if (stage === 'prospect') return 'Prospect';
  if (stage === 'lost') return 'Lost';
  if (stage === 'confirmed' || stage === 'event_held') return 'Client';
  return 'Lead';
}

export const STATUSES: Status[] = ['Prospect', 'Lead', 'Client', 'Lost'];

export const LOST_REASONS: { id: LostReason; label: string }[] = [
  { id: 'date_unavailable', label: 'Date unavailable' },
  { id: 'over_budget', label: 'Over budget' },
  { id: 'chose_another_venue', label: 'Chose another venue' },
  { id: 'went_quiet', label: 'Went quiet' },
  { id: 'guest_count_too_large', label: 'Guest count too large' },
  { id: 'other', label: 'Other' },
];

export const LOST_REASON_LABEL = Object.fromEntries(
  LOST_REASONS.map((r) => [r.id, r.label]),
) as Record<LostReason, string>;

export const SOURCES: { id: Source; label: string }[] = [
  { id: 'website_form', label: 'Website form' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'google', label: 'Google' },
  { id: 'referral', label: 'Referral' },
  { id: 'wedding_expo', label: 'Wedding expo' },
  { id: 'mailchimp_signup', label: 'Mailchimp signup' },
  { id: 'newsletter_form', label: 'Newsletter form' },
  { id: 'other', label: 'Other' },
];

export const SOURCE_LABEL = Object.fromEntries(SOURCES.map((s) => [s.id, s.label])) as Record<
  Source,
  string
>;

export const AUDIENCES: { id: Audience; label: string }[] = [
  { id: 'milestone', label: 'Milestone & Celebration' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'accessibility', label: 'Accessibility-led' },
];

export const AUDIENCE_LABEL = Object.fromEntries(AUDIENCES.map((a) => [a.id, a.label])) as Record<
  Audience,
  string
>;

/** Interactions that count as "being in touch" for the follow-up list. Notes don't count. */
export const CONTACT_TYPES: ActivityType[] = [
  'email_out',
  'email_in',
  'call',
  'tour_booked',
  'tour_attended',
  'proposal_sent',
];

/** Outgoing replies from the team, used for first reply time. */
export const REPLY_TYPES: ActivityType[] = ['email_out', 'call'];

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  form_submission: 'Form submission',
  email_out: 'Email sent',
  email_in: 'Email received',
  call: 'Call',
  note: 'Note',
  tour_booked: 'Tour booked',
  tour_attended: 'Tour attended',
  tour_no_show: 'Tour no-show',
  tour_cancelled: 'Tour cancelled',
  tour_rescheduled: 'Tour rescheduled',
  event_booked: 'Event booked',
  event_moved: 'Event date moved',
  event_cancelled: 'Event cancelled',
  proposal_sent: 'Proposal sent',
  review_requested: 'Review requested',
  mailchimp_signup: 'Mailchimp signup',
  edm_open: 'EDM opened',
  edm_click: 'EDM link clicked',
  web_visit: 'Website visit',
};

export const SPACE_LABEL = {
  altar_room: 'Altar Room (up to 150)',
  altar_room_plus: 'Altar Room + second space (160+)',
} as const;

/** Rules from the Booking Journey Map and Marketing Strategy. */
/** Starting values for the rules, from the Booking Journey Map and Marketing Strategy. */
export const DEFAULT_RULES: Rules = {
  followUpDays: 5,
  replyWithinHours: 24,
  proposalWithinHours: 48,
  altarRoomCapacity: 150,
  /** Mailchimp signups show as new for this many days if nobody actions them. */
  newSignupDays: 7,
};

/**
 * The rules currently in force. The store copies the values saved in Settings over
 * these, so everything that reads RULES follows Settings.
 */
export const RULES: Rules = { ...DEFAULT_RULES };
