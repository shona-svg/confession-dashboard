import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import type { Contact } from '../data/types';
import { RULES, STAGE_LABEL } from '../lib/stages';
import type { Insight } from '../lib/metrics';
import { formatDateTime, formatMoney, fullName, timeAgo } from '../lib/format';
import { Empty, OwnerDot, StatusTag } from '../components/ui';
import { LogActivityModal } from '../components/modals';
import { EmailComposer } from '../components/EmailComposer';

export default function FollowUpsPage() {
  const { data, insights } = useStore();
  const [owner, setOwner] = useState('');
  const [logging, setLogging] = useState<Contact | null>(null);
  const [emailing, setEmailing] = useState<Contact | null>(null);
  const all = [...insights.values()].filter((i) => !owner || i.contact.ownerId === owner);

  const noReply = all.filter((i) => i.replyOverdue).sort((a, b) => a.enquiredAt! - b.enquiredAt!);
  const quiet = all
    .filter((i) => i.followUpDue && !i.replyOverdue)
    .sort((a, b) => (b.daysSinceContact ?? 0) - (a.daysSinceContact ?? 0));
  const proposals = all.filter((i) => i.proposalOverdue);

  const row = (i: Insight, detail: string) => (
    <div className="list-row" key={i.contact.id} style={{ flexWrap: 'wrap' }}>
      <OwnerDot id={i.contact.ownerId} />
      <div className="grow">
        <Link className="title" to={`/contacts/${i.contact.id}`}>
          {fullName(i.contact)}
        </Link>
        <div className="meta">
          {STAGE_LABEL[i.contact.stage]} · {data.eventTypes.find((e) => e.id === i.contact.eventTypeId)?.name ?? 'Event TBC'} ·{' '}
          {formatMoney(i.contact.estimatedValue)} · {detail}
        </div>
      </div>
      <StatusTag stage={i.contact.stage} />
      <button className="btn small primary" onClick={() => setEmailing(i.contact)}>
        Send follow-up
      </button>
      <button className="btn small" onClick={() => setLogging(i.contact)}>
        Log call
      </button>
    </div>
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">A personal call or message, never an automated chase</div>
          <h1 className="page-title">Follow-ups</h1>
        </div>
        <select id="fu-owner" className="select" style={{ width: 'auto' }} value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
          <option value="">Everyone</option>
          {data.team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Waiting for a first reply</h2>
          <span className="card-note">Over {RULES.replyWithinHours} hours since they enquired</span>
        </div>
        {noReply.length === 0 ? (
          <Empty title="Nobody waiting">Every new enquiry has had a reply.</Empty>
        ) : (
          <div className="list">{noReply.map((i) => row(i, `enquired ${timeAgo(i.enquiredAt!)}`))}</div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">No contact in {RULES.followUpDays}+ days</h2>
          <span className="card-note">Open leads, longest silence first. Notes don't count as contact</span>
        </div>
        {quiet.length === 0 ? (
          <Empty title="All caught up">Everyone has heard from you recently.</Empty>
        ) : (
          <div className="list">
            {quiet.map((i) =>
              row(
                i,
                `${i.daysSinceContact} days quiet · last: ${i.lastContactSummary || 'enquiry'}${
                  i.lastContactAt ? ` (${formatDateTime(i.lastContactAt)})` : ''
                }`,
              ),
            )}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Proposals overdue</h2>
          <span className="card-note">Toured more than {RULES.proposalWithinHours} hours ago with no proposal sent</span>
        </div>
        {proposals.length === 0 ? (
          <Empty title="Right on time">Every toured lead has a proposal.</Empty>
        ) : (
          <div className="list">
            {proposals.map((i) => row(i, `toured ${timeAgo(i.lastAttendedTourAt!)}`))}
          </div>
        )}
      </section>

      {logging && <LogActivityModal contact={logging} onClose={() => setLogging(null)} />}
      {emailing && <EmailComposer contact={emailing} onClose={() => setEmailing(null)} />}
    </div>
  );
}
