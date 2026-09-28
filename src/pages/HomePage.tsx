import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import { funnel, homeStats, rangeFor } from '../lib/metrics';
import { formatDateTime, formatMoneyShort, formatTime, fullName } from '../lib/format';
import { STAGE_LABEL } from '../lib/stages';
import { Funnel } from '../components/charts';
import { Empty, Flags, OwnerDot, StatusTag } from '../components/ui';
import { BookTourModal, ContactFormModal } from '../components/modals';
import { PlusIcon } from '../components/Icons';
import { NewLeads } from '../components/NewLeads';
import { format, isToday, isTomorrow } from 'date-fns';

export default function HomePage() {
  const { data, insights, now } = useStore();
  const [modal, setModal] = useState<'contact' | 'tour' | null>(null);
  const stats = homeStats(data, insights, now);
  const f = funnel(insights, rangeFor('90d', now));
  const all = [...insights.values()];

  const replyOverdue = all.filter((i) => i.replyOverdue);
  const proposalOverdue = all.filter((i) => i.proposalOverdue);
  const unmarkedTours = data.tours.filter((t) => t.status === 'booked' && new Date(t.scheduledFor).getTime() < now);

  const followUps = all
    .filter((i) => i.followUpDue)
    .sort((a, b) => (b.daysSinceContact ?? 0) - (a.daysSinceContact ?? 0))
    .slice(0, 6);

  const upcoming = data.tours
    .filter((t) => t.status === 'booked' && new Date(t.scheduledFor).getTime() >= now)
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
    .slice(0, 6);

  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{format(now, 'EEEE d MMMM')}</div>
          <h1 className="page-title">{greeting}</h1>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => setModal('tour')}>
            Book a tour
          </button>
          <button className="btn primary" onClick={() => setModal('contact')}>
            <PlusIcon size={16} /> New enquiry
          </button>
        </div>
      </div>

      <NewLeads />

      <section className="kpis" aria-label="This week at a glance">
        <div className="kpi feature">
          <span className="kpi-label">New enquiries this week</span>
          <span className="kpi-value">{stats.newEnquiries}</span>
          <span className="kpi-sub">Since Monday</span>
        </div>
        <Link to="/tours" className="kpi" style={{ textDecoration: 'none' }}>
          <span className="kpi-label">Tours, next 7 days</span>
          <span className="kpi-value">{stats.toursNext7}</span>
          <span className="kpi-sub">See the tour calendar</span>
        </Link>
        <Link to="/pipeline" className="kpi" style={{ textDecoration: 'none' }}>
          <span className="kpi-label">Open pipeline</span>
          <span className="kpi-value">{formatMoneyShort(stats.openValue)}</span>
          <span className="kpi-sub">{stats.openCount} open leads, estimated value</span>
        </Link>
        <div className="kpi">
          <span className="kpi-label">Confirmed, last 30 days</span>
          <span className="kpi-value">{stats.confirmed30}</span>
          <span className="kpi-sub">{formatMoneyShort(stats.confirmed30Value)} in bookings</span>
        </div>
      </section>

      <section className="attention" aria-label="Needs attention">
        <Link to="/follow-ups" className={`attn ${replyOverdue.length ? 'bad' : 'ok'}`}>
          <span className="n">{replyOverdue.length}</span>
          <span>
            <span className="t">Waiting 24h+ for a first reply</span>
            <br />
            <span className="d">Target: same business day</span>
          </span>
        </Link>
        <Link to="/pipeline" className={`attn ${proposalOverdue.length ? 'bad' : 'ok'}`}>
          <span className="n">{proposalOverdue.length}</span>
          <span>
            <span className="t">Proposals overdue</span>
            <br />
            <span className="d">Toured more than 48 hours ago</span>
          </span>
        </Link>
        <Link to="/tours" className={`attn ${unmarkedTours.length ? 'warn' : 'ok'}`}>
          <span className="n">{unmarkedTours.length}</span>
          <span>
            <span className="t">Tours need an outcome</span>
            <br />
            <span className="d">Mark attended or no-show</span>
          </span>
        </Link>
      </section>

      <div className="grid-3-1">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Follow-ups</h2>
            <Link to="/follow-ups" className="small" style={{ color: 'var(--pink-ink)', fontWeight: 600 }}>
              See all
            </Link>
          </div>
          {followUps.length === 0 ? (
            <Empty title="All caught up">Every open lead has heard from you in the last 5 days.</Empty>
          ) : (
            <div className="list">
              {followUps.map((i) => (
                <div className="list-row" key={i.contact.id}>
                  <OwnerDot id={i.contact.ownerId} />
                  <div className="grow">
                    <Link className="title" to={`/contacts/${i.contact.id}`}>
                      {fullName(i.contact)}
                    </Link>
                    <div className="meta">
                      {STAGE_LABEL[i.contact.stage]} · last: {i.lastContactSummary || 'Enquiry'}
                    </div>
                  </div>
                  <Flags insight={i} compact />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Upcoming tours</h2>
            <Link to="/tours" className="small" style={{ color: 'var(--pink-ink)', fontWeight: 600 }}>
              Calendar
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <Empty title="No tours booked">Book one from a contact's page.</Empty>
          ) : (
            <div className="list">
              {upcoming.map((t) => {
                const c = insights.get(t.contactId)?.contact;
                if (!c) return null;
                const d = new Date(t.scheduledFor);
                const day = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEE d MMM');
                return (
                  <div className="list-row" key={t.id}>
                    <span className="time-chip">{formatTime(t.scheduledFor)}</span>
                    <div className="grow">
                      <Link className="title" to={`/contacts/${c.id}`}>
                        {fullName(c)}
                      </Link>
                      <div className="meta">
                        {day} · {data.eventTypes.find((e) => e.id === c.eventTypeId)?.name ?? 'Event TBC'}
                        {c.guestCount ? ` · ${c.guestCount} guests` : ''}
                      </div>
                    </div>
                    <OwnerDot id={t.hostId} />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">The journey, last 90 days</h2>
          <span className="card-note">
            {f.cohortSize} enquiries · {f.prospects} new prospects · {f.lost} lost ·{' '}
            <Link to="/reports" style={{ color: 'var(--pink-ink)', fontWeight: 600 }}>
              Full reports
            </Link>
          </span>
        </div>
        <Funnel steps={f.steps} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Latest enquiries</h2>
        </div>
        <div className="list">
          {all
            .filter((i) => i.enquiredAt)
            .sort((a, b) => b.enquiredAt! - a.enquiredAt!)
            .slice(0, 5)
            .map((i) => (
              <div className="list-row" key={i.contact.id}>
                <div className="grow">
                  <Link className="title" to={`/contacts/${i.contact.id}`}>
                    {fullName(i.contact)}
                  </Link>
                  <div className="meta">
                    {formatDateTime(i.enquiredAt!)} · {data.eventTypes.find((e) => e.id === i.contact.eventTypeId)?.name ?? 'Event TBC'}
                  </div>
                </div>
                <Flags insight={i} compact />
                <StatusTag stage={i.contact.stage} />
              </div>
            ))}
        </div>
      </section>

      {modal === 'contact' && <ContactFormModal onClose={() => setModal(null)} />}
      {modal === 'tour' && <BookTourModal onClose={() => setModal(null)} />}
    </div>
  );
}
