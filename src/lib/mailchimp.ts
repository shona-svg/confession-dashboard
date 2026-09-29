// How the dashboard organises people in Mailchimp (phase 6).
//
// One audience, "Confession Disciples", for everyone who has agreed to hear from us.
// Mailchimp recommends a single audience: splitting into several lists means paying
// for the same person twice and losing track of their history. Inside it:
//   • Groups  = what people told us they're interested in (newsletter form choices).
//   • Tags    = what we know about them (persona, event type, stage, source, website interest).
// Segments for each EDM are built from groups + tags, e.g. "Persona: Corporate" + "Status: Lead".
//
// Only people who've agreed to marketing are synced. Accessibility needs never leave the dashboard.
import type { Contact, MarketingConsent } from '../data/types';
import { AUDIENCE_LABEL, SOURCE_LABEL, STAGE_LABEL, statusOf } from './stages';

export const MAILCHIMP_AUDIENCE = 'Confession Disciples';

/** The choices on the newsletter form. Each becomes a Mailchimp group. */
export const NEWSLETTER_INTERESTS = [
  'Milestone birthdays',
  'Engagements & wedding after-parties',
  'Corporate & end-of-year events',
  'Accessible events',
  'Venue news & events',
];

export const CONSENT_LABEL: Record<MarketingConsent, string> = {
  subscribed: 'Subscribed',
  not_subscribed: 'Not subscribed',
  unsubscribed: 'Unsubscribed',
};

const INTEREST_PREFIX = 'Interest: ';

export interface MailchimpRecord {
  audience: string;
  groups: string[];
  tags: string[];
}

export function mailchimpRecord(c: Contact, eventTypeName: string | null): MailchimpRecord {
  return {
    audience: MAILCHIMP_AUDIENCE,
    groups: c.tags.filter((t) => t.startsWith(INTEREST_PREFIX)).map((t) => t.slice(INTEREST_PREFIX.length)),
    tags: [
      `Persona: ${AUDIENCE_LABEL[c.audience]}`,
      ...(eventTypeName ? [`Event: ${eventTypeName}`] : []),
      `Status: ${statusOf(c.stage)}`,
      `Stage: ${STAGE_LABEL[c.stage]}`,
      `Source: ${SOURCE_LABEL[c.source]}`,
      ...c.tags.filter((t) => !t.startsWith(INTEREST_PREFIX)),
    ],
  };
}

/** Kept for existing callers: every tag and group as one list. */
export function mailchimpTags(c: Contact, eventTypeName: string | null): string[] {
  const r = mailchimpRecord(c, eventTypeName);
  return [...r.tags, ...r.groups.map((g) => `Group: ${g}`)];
}

/** How each tag family is worked out, for the Settings page. */
export const TAG_RULES: { family: string; example: string; from: string }[] = [
  { family: 'Persona', example: 'Persona: Corporate', from: 'Audience on the contact (Milestone & Celebration, Corporate, Accessibility-led)' },
  { family: 'Event', example: 'Event: Wedding after-party', from: 'Event type chosen on the enquiry form or set by the team' },
  { family: 'Status', example: 'Status: Lead', from: 'Prospect, Lead, Client or Lost, from the stage' },
  { family: 'Stage', example: 'Stage: Tour booked', from: 'Where they are in the journey' },
  { family: 'Source', example: 'Source: Instagram', from: 'How they found us' },
  { family: 'Browsed', example: 'Browsed: Corporate', from: 'Website tracking rules (Settings → Website tracking)' },
  { family: 'Your tags', example: 'Hot, Repeat client', from: 'Any tag the team adds to a contact' },
  { family: 'Groups', example: 'Corporate & end-of-year events', from: 'What people tick on the newsletter form' },
];
