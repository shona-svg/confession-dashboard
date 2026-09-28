// What the dashboard would send to Mailchimp for a contact (phase 6).
// Only people who've agreed to marketing are synced, and accessibility needs never leave the dashboard.
import type { Contact, MarketingConsent } from '../data/types';
import { AUDIENCE_LABEL, SOURCE_LABEL, STAGE_LABEL, statusOf } from './stages';

export const CONSENT_LABEL: Record<MarketingConsent, string> = {
  subscribed: 'Subscribed',
  not_subscribed: 'Not subscribed',
  unsubscribed: 'Unsubscribed',
};

export function mailchimpTags(c: Contact, eventTypeName: string | null): string[] {
  return [
    statusOf(c.stage),
    `Stage: ${STAGE_LABEL[c.stage]}`,
    ...(eventTypeName ? [eventTypeName] : []),
    AUDIENCE_LABEL[c.audience],
    `Source: ${SOURCE_LABEL[c.source]}`,
    ...c.tags,
  ];
}
