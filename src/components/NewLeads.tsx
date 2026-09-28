import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import type { Contact } from '../data/types';
import { RULES, SOURCE_LABEL } from '../lib/stages';
import { formatDate, fullName, timeAgo } from '../lib/format';
import { OwnerDot, useToast } from './ui';
import { BookTourModal, LogActivityModal } from './modals';

/** Enquiries and signups nobody has actioned yet, oldest first so nothing waits. */
export function NewLeads() {
  const { data, insights, now, acknowledge } = useStore();
  const toast = useToast();
  const [logging, setLogging] = useState<Contact | null>(null);
  const [touring, setTouring] = useState<Contact | null>(null);

  const fresh = [...insights.values()]
    .filter((i) => i.isNew)
    .sort((a, b) => {
      // Enquiries before newsletter signups, then longest-waiting first.
      const rank = (x: typeof a) => (x.contact.stage === 'lead' ? 0 : 1);
      return rank(a) - rank(b) || a.arrivedAt - b.arrivedAt;
    });

  return (
    <section className="new-leads" aria-labelledby="new-leads-title">
      <div className="new-leads-head">
        <div>
          <span className="eyebrow on-dark">Deal with these first</span>
          <h2 id="new-leads-title" className="new-leads-title">
            New leads <span className="new-count">{fresh.length}</span>
          </h2>
        </div>
        <p className="new-leads-note">
          From HubSpot forms and Mailchimp signups. A lead leaves this list once someone replies, calls, books a tour or
          marks it as seen.
        </p>
      </div>
      {fresh.length === 0 ? (
        <p className="new-leads-empty">Nothing new. Every enquiry has been looked after.</p>
      ) : (
        <div className="card-grid">
          {fresh.map((i) => {
            const c = i.contact;
            const waitedHours = (now - i.arrivedAt) / 3600_000;
            const late = c.stage === 'lead' && waitedHours > RULES.replyWithinHours;
            return (
              <article key={c.id} className={`deal new-card${late ? ' late' : ''}`}>
                <div className="top">
                  <span className={`tag ${c.stage === 'lead' ? 'status-Lead' : 'status-Prospect'}`}>
                    {c.stage === 'lead' ? 'Enquiry' : 'Signup'} · {SOURCE_LABEL[c.source]}
                  </span>
                  <OwnerDot id={c.ownerId} />
                </div>
                <div>
                  <Link to={`/contacts/${c.id}`} className="who new-name">
                    {fullName(c)}
                  </Link>
                  <div className="what">
                    {data.eventTypes.find((e) => e.id === c.eventTypeId)?.name ?? 'Event type not given'}
                    {c.guestCount ? ` · ${c.guestCount} guests` : ''}
                    <br />
                    {c.eventDate ? formatDate(c.eventDate, 'EEE d MMM yyyy') : 'No date yet'}
                  </div>
                </div>
                <div className={`new-wait${late ? ' late' : ''}`}>
                  {late ? 'Waiting ' : 'Arrived '}
                  {timeAgo(i.arrivedAt)}
                  {late ? ` · over ${RULES.replyWithinHours}h` : ''}
                </div>
                <div className="tour-actions">
                  <Link to={`/contacts/${c.id}`} className="btn small primary">
                    Open
                  </Link>
                  {c.stage === 'lead' ? (
                    <>
                      <button className="btn small" onClick={() => setLogging(c)}>
                        Log reply
                      </button>
                      <button className="btn small" onClick={() => setTouring(c)}>
                        Book tour
                      </button>
                    </>
                  ) : null}
                  <button
                    className="btn small ghost"
                    onClick={() => {
                      acknowledge(c.id);
                      toast(`${c.firstName} marked as seen`);
                    }}
                  >
                    Mark seen
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {logging && <LogActivityModal contact={logging} initialType="email_out" onClose={() => setLogging(null)} />}
      {touring && <BookTourModal contact={touring} onClose={() => setTouring(null)} />}
    </section>
  );
}
