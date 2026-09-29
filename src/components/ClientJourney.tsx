// A contact's progress through CONFESSION's Client Journey map
// (Awareness → Consideration → Conversion → Loyal for life).
import { useStore } from '../data/store';
import type { Insight } from '../lib/metrics';
import { REPLY_TYPES, RULES } from '../lib/stages';
import { formatDate } from '../lib/format';
import { bookingEvent, latestProposal } from '../lib/booking';

type StepState = 'done' | 'current' | 'upcoming' | 'skipped' | 'stopped';

interface Step {
  id: string;
  phase: number;
  title: string;
  hint: string;
  at: number | null;
  due: number | null;
}

const PHASES = [
  { name: 'Awareness', cls: 'ph-aware' },
  { name: 'Consideration', cls: 'ph-consider' },
  { name: 'Conversion', cls: 'ph-convert' },
  { name: 'Loyal for life', cls: 'ph-loyal' },
];

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export function ClientJourney({ insight }: { insight: Insight }) {
  const { data, now } = useStore();
  const c = insight.contact;
  const t = (iso: string) => new Date(iso).getTime();
  const firstTour = insight.tours[0];
  const attended = insight.tours.find((x) => x.status === 'attended');
  const proposalAt = insight.reachedAt.proposal_sent ?? null;
  const followUpAt = proposalAt
    ? data.activities
        .filter((a) => a.contactId === c.id && REPLY_TYPES.includes(a.type) && t(a.occurredAt) > proposalAt)
        .map((a) => t(a.occurredAt))
        .sort((a, b) => a - b)[0] ?? null
    : null;
  const proposalRecord = latestProposal(data, c.id);
  const bookingEv = bookingEvent(data, c.id);
  const eventAt = c.eventDate ? new Date(c.eventDate + 'T18:00:00').getTime() : null;
  const held = insight.reachedAt.event_held ?? (c.stage === 'event_held' ? eventAt : null);

  const steps: Step[] = [
    {
      id: 'enquiry',
      phase: 0,
      title: 'Enquiry received',
      hint: 'Call, web form, DM or referral',
      at: insight.enquiredAt,
      due: null,
    },
    {
      id: 'respond',
      phase: 0,
      title: 'Team responds and offers a tour',
      hint: `Same business day, always within ${RULES.replyWithinHours} hours`,
      at: insight.firstReplyAt,
      due: insight.enquiredAt ? insight.enquiredAt + RULES.replyWithinHours * HOUR : null,
    },
    {
      id: 'tour_booked',
      phase: 1,
      title: 'Tour booked',
      hint: 'Invite the whole decision-making group',
      at: insight.reachedAt.tour_booked ?? (firstTour ? t(firstTour.bookedAt) : null),
      due: null,
    },
    {
      id: 'toured',
      phase: 1,
      title: 'Client attends the tour',
      hint: 'Discovery questions only. No pricing',
      at: attended ? t(attended.scheduledFor) : (insight.reachedAt.toured ?? null),
      due: insight.nextTour ? t(insight.nextTour.scheduledFor) : null,
    },
    {
      id: 'proposal',
      phase: 1,
      title: 'Custom proposal sent',
      hint: `Within ${RULES.proposalWithinHours} hours of the tour`,
      at: proposalAt,
      due: insight.lastAttendedTourAt ? insight.lastAttendedTourAt + RULES.proposalWithinHours * HOUR : null,
    },
    {
      id: 'follow_up',
      phase: 1,
      title: 'Proposal follow-up',
      hint: 'Personal call or message if no reply in 3–4 business days',
      at: followUpAt ?? ((insight.reachedAt.finalising ?? insight.reachedAt.confirmed) && proposalAt ? (insight.reachedAt.finalising ?? insight.reachedAt.confirmed)! : null),
      due: proposalAt ? proposalAt + 4 * DAY : null,
    },
    {
      id: 'accepted',
      phase: 2,
      title: 'Accepts the proposal',
      hint: 'Then: Finalise booking',
      at: proposalRecord?.acceptedAt ? t(proposalRecord.acceptedAt) : (insight.reachedAt.finalising ?? null),
      due: null,
    },
    {
      id: 'signed',
      phase: 2,
      title: 'Signs the hire agreement',
      hint: 'Sent from the dashboard, signed online',
      at: bookingEv?.agreementSignedAt ? t(bookingEv.agreementSignedAt) : null,
      due: null,
    },
    {
      id: 'confirmed',
      phase: 2,
      title: 'Pays the deposit: event is live',
      hint: 'Date locked in and in the calendar',
      at: insight.reachedAt.confirmed ?? null,
      due: null,
    },
    {
      id: 'final',
      phase: 2,
      title: 'Payments finalised, details confirmed',
      hint: '2 weeks before: final numbers, run sheet, supplier insurance',
      at: held ? (eventAt ? eventAt - 14 * DAY : held) : null,
      due: eventAt && insight.reachedAt.confirmed ? eventAt - 14 * DAY : null,
    },
    {
      id: 'event',
      phase: 2,
      title: 'Event day',
      hint: 'Collect content, encourage tags and live stories',
      at: held ? eventAt : null,
      due: insight.reachedAt.confirmed ? eventAt : null,
    },
    {
      id: 'review',
      phase: 3,
      title: 'Personal follow-up and review request',
      hint: 'Every client, every time',
      at: c.reviewRequestedAt ? t(c.reviewRequestedAt) : null,
      due: held ? held + 5 * DAY : null,
    },
    {
      id: 'review_in',
      phase: 3,
      title: 'Review or testimonial received',
      hint: 'Feeds straight back into attracting the next client',
      at: c.reviewReceived ? (c.reviewRequestedAt ? t(c.reviewRequestedAt) : now) : null,
      due: null,
    },
  ];

  if (insight.reachedAt.prospect !== undefined) {
    steps.unshift({
      id: 'signup',
      phase: 0,
      title: 'Joined the mailing list',
      hint: 'Prospect: interested, no event details yet',
      at: insight.reachedAt.prospect,
      due: null,
    });
  }

  // Work out each step's state. Anything before the furthest completed step
  // that never happened was skipped. The first open step after it is "current".
  const lastDone = steps.reduce((acc, s, i) => (s.at !== null ? i : acc), -1);
  const lost = c.stage === 'lost';
  let currentAssigned = false;
  const states: StepState[] = steps.map((s, i) => {
    if (s.at !== null) return 'done';
    if (i < lastDone) return 'skipped';
    if (lost) return 'stopped';
    if (!currentAssigned) {
      currentAssigned = true;
      return 'current';
    }
    return 'upcoming';
  });
  const currentIdx = states.indexOf('current');
  const next = currentIdx >= 0 ? steps[currentIdx] : null;
  const overdue = next?.due != null && next.due < now && next.id !== 'final' && next.id !== 'event';

  return (
    <div className="cj">
      <div className={`cj-next${overdue ? ' overdue' : ''}${lost ? ' lost' : ''}`}>
        {lost ? (
          <>
            <span className="cj-next-label">Journey ended</span>
            <span>Followed up, then archived. They stay on the EDM list.</span>
          </>
        ) : next ? (
          <>
            <span className="cj-next-label">{overdue ? 'Overdue' : 'Next step'}</span>
            <strong>{next.title}</strong>
            {next.due != null && (
              <span className="muted">
                {overdue ? 'was due' : 'due'} {formatDate(next.due, 'EEE d MMM')}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="cj-next-label">Complete</span>
            <strong>Loyal for life. Every step done</strong>
          </>
        )}
      </div>
      <div className="cj-phases">
        {PHASES.map((p, pi) => (
          <section key={p.name} className={`cj-phase ${p.cls}`} aria-label={p.name}>
            <h3 className="cj-phase-name">{p.name}</h3>
            <ol className="cj-steps">
              {steps.map((s, i) =>
                s.phase !== pi ? null : (
                  <li key={s.id} className={`cj-step ${states[i]}`}>
                    <span className="cj-mark" aria-hidden="true">
                      {states[i] === 'done' ? '✓' : states[i] === 'skipped' ? '–' : ''}
                    </span>
                    <span className="cj-text">
                      <span className="cj-title">{s.title}</span>
                      <span className="cj-meta">
                        {states[i] === 'done' && s.at !== null
                          ? formatDate(s.at, 'd MMM yyyy')
                          : states[i] === 'skipped'
                            ? 'Skipped'
                            : s.hint}
                      </span>
                    </span>
                    <span className="sr-only">
                      {states[i] === 'done' ? 'Done' : states[i] === 'current' ? 'Current step' : states[i]}
                    </span>
                  </li>
                ),
              )}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
