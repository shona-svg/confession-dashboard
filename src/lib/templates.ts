// Starting points for one-to-one emails. Every one is edited before sending:
// the Booking Journey Map is clear that follow-ups are personal, never automated.
import type { Contact, Stage } from '../data/types';

export interface EmailTemplate {
  id: string;
  name: string;
  when: string;
  subject: string;
  body: string;
  asksForGoogleReview?: boolean;
}

export const TEMPLATES: EmailTemplate[] = [
  {
    id: 'first_reply',
    name: 'First reply',
    when: 'New enquiry. Same business day',
    subject: 'Your {{eventType}} at Confession',
    body: `Hi {{firstName}},

Thanks so much for getting in touch about your {{eventType}}{{eventDateText}}. It sounds like a great night.

The best way to picture it is to see the church in person. Could you come in for a quick tour? I have times available this week and next. Bring along whoever else needs to say yes.

Let me know what suits and I'll lock it in.

{{senderFirstName}}
Confession · 60 Marryatt Street, Port Adelaide`,
  },
  {
    id: 'tour_confirm',
    name: 'Tour confirmation',
    when: 'Straight after booking a tour',
    subject: 'Your tour of Confession: {{tourDate}}',
    body: `Hi {{firstName}},

You're booked in for a tour on {{tourDate}}. We're at 60 Marryatt Street, Port Adelaide, with street parking out front and ramp access at the main entrance.

It takes about 30 minutes. Bring anyone who'll be part of the decision.

See you then,
{{senderFirstName}}`,
  },
  {
    id: 'after_tour',
    name: 'After the tour',
    when: 'Day of the tour',
    subject: 'Lovely to show you around',
    body: `Hi {{firstName}},

Thanks for coming in today. It was great to hear about your plans for the {{eventType}}.

I'm putting together a proposal based on everything we talked about, and you'll have it within 48 hours. Shout if anything else comes to mind in the meantime.

{{senderFirstName}}`,
  },
  {
    id: 'proposal_follow_up',
    name: 'Proposal follow-up',
    when: '3–4 business days after the proposal',
    subject: 'Checking in on your proposal',
    body: `Hi {{firstName}},

Just checking you received the proposal for your {{eventType}}, and whether you had any questions.

Happy to jump on a call, or adjust anything so it fits exactly what you're after. The date is still free for now, but I can't promise it will stay that way for long.

{{senderFirstName}}`,
  },
  {
    id: 'gone_quiet',
    name: 'Gentle nudge',
    when: 'No reply for a while',
    subject: 'Still planning your {{eventType}}?',
    body: `Hi {{firstName}},

I didn't want your enquiry to slip through the cracks. Are you still planning your {{eventType}}?

If the timing's changed or you've gone another way, no worries at all. Just let me know and I'll stop chasing.

{{senderFirstName}}`,
  },
  {
    id: 'thank_you',
    name: 'Thank you and review request',
    when: 'A few days after the event',
    subject: 'Thank you, and a small favour',
    body: `Hi {{firstName}},

Thank you for celebrating with us. We loved having you and your guests in the church.

If you have a minute, a Google review would mean the world to a small venue like ours: [Google review link]

And if you have photos you're happy to share, we'd love to see them.

{{senderFirstName}}`,
    asksForGoogleReview: true,
  },
  {
    id: 'blank',
    name: 'Blank email',
    when: 'Anything else',
    subject: '',
    body: `Hi {{firstName}},



{{senderFirstName}}`,
  },
];

/** The template that fits where the client is in the journey. */
export function suggestedTemplate(stage: Stage, hasUpcomingTour: boolean, replied: boolean): string {
  switch (stage) {
    case 'lead':
      return replied ? 'gone_quiet' : 'first_reply';
    case 'tour_booked':
      return hasUpcomingTour ? 'tour_confirm' : 'gone_quiet';
    case 'toured':
      return 'after_tour';
    case 'proposal_sent':
      return 'proposal_follow_up';
    case 'event_held':
      return 'thank_you';
    default:
      return 'blank';
  }
}

export interface MergeValues {
  contact: Contact;
  eventTypeName: string | null;
  tourDate: string | null;
  senderName: string;
}

/** Fills {{placeholders}}. Anything unknown is left in brackets so it's easy to spot and edit. */
export function fillTemplate(text: string, v: MergeValues): string {
  const eventDate = v.contact.eventDate
    ? new Date(v.contact.eventDate + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;
  const values: Record<string, string> = {
    firstName: v.contact.firstName,
    eventType: v.eventTypeName?.toLowerCase() ?? 'event',
    eventDateText: eventDate ? ` on ${eventDate}` : '',
    tourDate: v.tourDate ?? '[tour date]',
    senderFirstName: v.senderName.split(' ')[0] ?? v.senderName,
    senderName: v.senderName,
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? `[${key}]`);
}
