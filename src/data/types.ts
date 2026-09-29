import type { EmailTemplate } from '../lib/templates';

// The shapes of the records the dashboard keeps. These mirror the database
// tables described in docs/PLAN.md, so switching from sample data to Supabase
// (phase 3) doesn't change the pages.

export type Stage =
  | 'prospect'
  | 'lead'
  | 'tour_booked'
  | 'toured'
  | 'proposal_sent'
  | 'finalising'
  | 'confirmed'
  | 'event_held'
  | 'lost';

export type Status = 'Prospect' | 'Lead' | 'Client' | 'Lost';

export type Audience = 'milestone' | 'corporate' | 'accessibility';

export type Source =
  | 'website_form'
  | 'instagram'
  | 'google'
  | 'referral'
  | 'wedding_expo'
  | 'mailchimp_signup'
  | 'newsletter_form'
  | 'other';

export type LostReason =
  | 'date_unavailable'
  | 'over_budget'
  | 'chose_another_venue'
  | 'went_quiet'
  | 'guest_count_too_large'
  | 'other';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

export interface EventType {
  id: string;
  name: string;
  defaultAudience: Audience;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  eventTypeId: string | null;
  audience: Audience;
  eventDate: string | null; // yyyy-mm-dd
  guestCount: number | null;
  estimatedValue: number | null;
  source: Source;
  ownerId: string | null;
  tags: string[];
  stage: Stage;
  lostReason: LostReason | null;
  lostReasonNote: string;
  lostFromStage: Stage | null;
  createdAt: string; // ISO date-time
  reviewRequestedAt: string | null;
  reviewReceived: boolean;
  /** Set when someone marks a new enquiry as seen without needing to reply. */
  acknowledgedAt: string | null;
  /** In the client's own words, only to plan their event. Sensitive: never sent to Mailchimp. */
  accessibilityNeeds: string;
  /** Whether they've agreed to marketing email. Only "subscribed" contacts go to Mailchimp. */
  marketingConsent: MarketingConsent;
}

export type MarketingConsent = 'subscribed' | 'not_subscribed' | 'unsubscribed';

export interface StageChange {
  id: string;
  contactId: string;
  fromStage: Stage | null;
  toStage: Stage;
  changedAt: string;
  changedBy: string; // team member id, or a label such as "Website form" or "Mailchimp sync"
}

export type TourStatus = 'booked' | 'attended' | 'no_show' | 'cancelled';

export interface Tour {
  id: string;
  contactId: string;
  scheduledFor: string;
  bookedAt: string;
  status: TourStatus;
  hostId: string | null;
  notes: string;
}

export type EventStatus = 'hold' | 'confirmed' | 'cancelled';
export type Space = 'altar_room' | 'altar_room_plus';

/** A function booked at the venue. One event at a time, so dates shouldn't overlap. */
export interface VenueEvent {
  id: string;
  contactId: string;
  date: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  space: Space;
  guestCount: number | null;
  status: EventStatus; // hold = pencilled in, not paid; confirmed = deposit paid
  notes: string;
  createdAt: string;
  // Booking paperwork ("Finalise booking"): agreement → signature → deposit invoice → deposit paid.
  agreementTemplateId?: string | null;
  agreementText?: string;
  agreementSentAt?: string | null;
  agreementSignedAt?: string | null;
  signedName?: string;
  signatureImage?: string; // preview only: the live system stores signed PDFs in file storage
  depositAmount?: number | null;
  paymentLink?: string;
  depositInvoiceSentAt?: string | null;
  depositPaidAt?: string | null;
}

/** A proposal template for one audience persona (the designed PDF layouts come later). */
export interface ProposalTemplate {
  id: string;
  name: string;
  audience: Audience;
  headline: string;
  intro: string;
  inclusions: string; // one per line
  nextSteps: string;
}

export interface ProposalLine {
  label: string;
  amount: number | null;
}

export interface Proposal {
  id: string;
  contactId: string;
  templateId: string;
  headline: string;
  intro: string;
  inclusions: string;
  nextSteps: string;
  lines: ProposalLine[];
  status: 'draft' | 'sent' | 'accepted' | 'declined';
  createdAt: string;
  sentAt: string | null;
  acceptedAt: string | null;
}

export interface AgreementTemplate {
  id: string;
  name: string;
  body: string;
}

export type ActivityType =
  | 'form_submission'
  | 'email_out'
  | 'email_in'
  | 'call'
  | 'note'
  | 'tour_booked'
  | 'tour_attended'
  | 'tour_no_show'
  | 'tour_cancelled'
  | 'tour_rescheduled'
  | 'event_booked'
  | 'event_moved'
  | 'event_cancelled'
  | 'proposal_sent'
  | 'review_requested'
  | 'mailchimp_signup'
  | 'edm_open'
  | 'edm_click'
  | 'web_visit'
  | 'proposal_accepted'
  | 'agreement_sent'
  | 'agreement_signed'
  | 'invoice_sent'
  | 'deposit_paid';

export interface Activity {
  id: string;
  contactId: string;
  type: ActivityType;
  occurredAt: string;
  summary: string;
  createdBy: string;
  /** Full text of an email sent from the dashboard (the live version reads it from Gmail instead). */
  detail?: string;
}

/** The adjustable rules, edited in Settings. */
export interface Rules {
  followUpDays: number;
  replyWithinHours: number;
  proposalWithinHours: number;
  altarRoomCapacity: number;
  newSignupDays: number;
}

/** Website tracking: a page address that tells us what someone is interested in. */
export interface TrackingRule {
  id: string;
  match: string; // part of the page address, e.g. /functions/weddings
  tag: string; // tag added to the contact (and synced to Mailchimp)
  alert: boolean; // put them on the "Back on the website" list
}

export interface Dataset {
  team: TeamMember[];
  eventTypes: EventType[];
  contacts: Contact[];
  stageChanges: StageChange[];
  tours: Tour[];
  events: VenueEvent[];
  activities: Activity[];
  rules: Rules;
  templates: EmailTemplate[];
  trackingRules: TrackingRule[];
  proposals: Proposal[];
  proposalTemplates: ProposalTemplate[];
  agreementTemplates: AgreementTemplate[];
}
