// Proposals and the "Finalise booking" steps:
// proposal sent → accepted → hire agreement sent → signed → deposit invoice sent → deposit paid (event is LIVE).
import type { AgreementTemplate, Contact, Dataset, Proposal, ProposalTemplate, VenueEvent } from '../data/types';
import { SPACE_LABEL } from './stages';

export const DEFAULT_PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  {
    id: 'pt-milestone',
    name: 'Milestone & Celebration',
    audience: 'milestone',
    headline: 'Your {{eventType}} at Confession',
    intro:
      'Thank you for walking through the church with us. Here is your night as we talked about it: the whole venue, exclusively yours, from the first guest through the door to the last song.',
    inclusions:
      'Exclusive use of the Altar Room for your event\n30-minute bump-in and bump-out, included\nOur accessible dance floor, stage and lowered bar\nA dedicated Confession host on the night\nStyling guidance and trusted supplier recommendations',
    nextSteps:
      'To lock in {{eventDate}}, reply to accept this proposal. We will then send your hire agreement to sign online, followed by the deposit invoice.',
  },
  {
    id: 'pt-corporate',
    name: 'Corporate',
    audience: 'corporate',
    headline: '{{company}} at Confession',
    intro:
      'Thanks for touring Confession. Below is a proposal built around what you told us, with clear inclusions and one point of contact from now until bump-out.',
    inclusions:
      'Exclusive use of the venue for your function\nFull AV and the house sound system\nFully accessible venue: ramp access, DDA bathrooms, lowered bar\nOne point of contact from booking to bump-out\nClear run sheet and supplier coordination',
    nextSteps:
      'Reply to accept and we will send the hire agreement for e-signature, then the deposit invoice for your accounts team.',
  },
  {
    id: 'pt-accessibility',
    name: 'Accessibility-led',
    audience: 'accessibility',
    headline: 'Your {{eventType}}, built for everyone',
    intro:
      'Thank you for telling us what your guests need. Confession was designed to be accessible from day one, and this proposal covers exactly how we will look after everyone on the night.',
    inclusions:
      'Exclusive use of the Altar Room\nRamp access, DDA-compliant bathrooms and a lowered bar\nOur wheelchair-friendly dance floor and accessible stage\nAuslan interpreter and Braille menus on request\nGuide dogs always welcome',
    nextSteps:
      'Reply to accept, and we will send your hire agreement to sign online. Ask us anything specific: we would rather over-explain than have you guess.',
  },
];

// Starting point only. The team's lawyer-approved terms replace this before any client sees it.
export const DEFAULT_AGREEMENT_TEMPLATES: AgreementTemplate[] = [
  {
    id: 'at-hire',
    name: 'Terms of hire agreement',
    body: `CONFESSION · VENUE HIRE AGREEMENT
60 Marryatt Street, Port Adelaide SA 5015

Hirer: {{clientName}}{{companyLine}}
Email: {{clientEmail}}
Event: {{eventType}}
Date: {{eventDate}}, {{eventTimes}}
Space: {{space}}
Guests: {{guests}}

1. Booking and deposit
A non-refundable deposit equal to the hire fee secures the date and is credited against the final balance. [Confirm wording with your lawyer.]

2. Security bond
A refundable security bond is collected with the deposit and returned within 5 business days of the event, provided there is no damage and no outstanding bar tab.

3. Final numbers and suppliers
Final guest numbers, the run sheet, and supplier names, contacts and public liability certificates are due 5–7 days before the event. Suppliers not on the confirmed list will not be given bump-in access.

4. Bump-in and bump-out
A 30-minute bump-in and 30-minute bump-out are included in the hire.

5. Guest numbers over 150
The Altar Room holds 150 guests. Events of 160+ confirmed guests use the second space with 4 weeks' notice and a fixed surcharge.

6. Cancellation, conduct, liquor licensing and liability
[Insert your lawyer-approved terms here.]

By signing, the hirer agrees to these terms.`,
  },
];

// ---------- Filling in placeholders ----------

function niceDate(d: string | null | undefined) {
  if (!d) return '[event date]';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function fillBookingText(text: string, data: Dataset, c: Contact, ev?: Partial<VenueEvent>): string {
  const eventType = data.eventTypes.find((e) => e.id === c.eventTypeId)?.name ?? 'event';
  const values: Record<string, string> = {
    clientName: `${c.firstName} ${c.lastName}`.trim(),
    firstName: c.firstName,
    company: c.company || `${c.firstName} ${c.lastName}`.trim(),
    companyLine: c.company ? ` (${c.company})` : '',
    clientEmail: c.email,
    eventType: eventType.toLowerCase(),
    eventDate: niceDate(ev?.date ?? c.eventDate),
    eventTimes: ev?.startTime && ev?.endTime ? `${ev.startTime} to ${ev.endTime}` : '[times]',
    space: ev?.space ? SPACE_LABEL[ev.space] : SPACE_LABEL.altar_room,
    guests: String(ev?.guestCount ?? c.guestCount ?? '[guests]'),
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => values[k] ?? `[${k}]`);
}

export function suggestedProposalTemplate(data: Dataset, c: Contact): ProposalTemplate | undefined {
  return data.proposalTemplates.find((t) => t.audience === c.audience) ?? data.proposalTemplates[0];
}

export function proposalTotal(p: Pick<Proposal, 'lines'>): number {
  return p.lines.reduce((sum, l) => sum + (l.amount ?? 0), 0);
}

// ---------- Where is the booking up to? ----------

export type BookingStep =
  | 'proposal_to_send'
  | 'awaiting_acceptance'
  | 'agreement_to_send'
  | 'awaiting_signature'
  | 'invoice_to_send'
  | 'awaiting_deposit'
  | 'live';

export const BOOKING_STEP_LABEL: Record<BookingStep, string> = {
  proposal_to_send: 'Proposal to send',
  awaiting_acceptance: 'Waiting on the proposal',
  agreement_to_send: 'Send hire agreement',
  awaiting_signature: 'Waiting for signature',
  invoice_to_send: 'Signed: send deposit invoice',
  awaiting_deposit: 'Waiting for deposit',
  live: 'Live',
};

/** The booking's paperwork event: the newest event that isn't cancelled. */
export function bookingEvent(data: Dataset, contactId: string): VenueEvent | undefined {
  return data.events
    .filter((e) => e.contactId === contactId && e.status !== 'cancelled')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function latestProposal(data: Dataset, contactId: string): Proposal | undefined {
  return data.proposals.filter((p) => p.contactId === contactId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function bookingStep(data: Dataset, c: Contact): BookingStep | null {
  if (c.stage === 'confirmed' || c.stage === 'event_held') return 'live';
  if (c.stage === 'proposal_sent') {
    const p = latestProposal(data, c.id);
    return p && p.status === 'draft' ? 'proposal_to_send' : 'awaiting_acceptance';
  }
  if (c.stage !== 'finalising') return null;
  const ev = bookingEvent(data, c.id);
  if (!ev || !ev.agreementSentAt) return 'agreement_to_send';
  if (!ev.agreementSignedAt) return 'awaiting_signature';
  if (!ev.depositInvoiceSentAt) return 'invoice_to_send';
  if (!ev.depositPaidAt) return 'awaiting_deposit';
  return 'live';
}
