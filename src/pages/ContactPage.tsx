import { useMemo, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore, useTeamName } from '../data/store';
import type { ActivityType, Stage } from '../data/types';
import {
  ACTIVITY_LABEL,
  AUDIENCE_LABEL,
  JOURNEY,
  LOST_REASON_LABEL,
  SOURCE_LABEL,
  STAGE_LABEL,
  stageIndex,
} from '../lib/stages';
import { formatDate, formatDateTime, formatHours, formatMoney, fullName, timeAgo, daysUntil } from '../lib/format';
import { Empty, Flags, OwnerDot, StageNum, StatusTag, useToast } from '../components/ui';
import { BookTourModal, ContactFormModal, LogActivityModal, LostModal } from '../components/modals';
import {
  CalendarIcon,
  CursorIcon,
  FormIcon,
  MailIcon,
  NoteIcon,
  PhoneIcon,
  StarIcon,
  StepIcon,
} from '../components/Icons';

type ModalKind = { kind: 'log'; type: ActivityType } | { kind: 'tour' } | { kind: 'edit' } | { kind: 'lost' };

const CLIENT_TYPES: ActivityType[] = ['form_submission', 'email_in', 'edm_open', 'edm_click', 'mailchimp_signup'];

function iconFor(type: ActivityType | 'stage') {
  switch (type) {
    case 'stage':
      return StepIcon;
    case 'call':
      return PhoneIcon;
    case 'email_in':
    case 'email_out':
    case 'edm_open':
    case 'mailchimp_signup':
      return MailIcon;
    case 'edm_click':
      return CursorIcon;
    case 'form_submission':
    case 'proposal_sent':
      return FormIcon;
    case 'tour_booked':
    case 'tour_attended':
    case 'tour_no_show':
    case 'tour_cancelled':
      return CalendarIcon;
    case 'review_requested':
      return StarIcon;
    default:
      return NoteIcon;
  }
}

export default function ContactPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useStore();
  const { data, insights, moveStage, updateContact, setTourStatus, requestReview, deleteContact } = store;
  const teamName = useTeamName();
  const toast = useToast();
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'team' | 'client' | 'stages'>('all');

  const insight = id ? insights.get(id) : undefined;

  const timeline = useMemo(() => {
    if (!id) return [];
    const items = [
      ...data.activities
        .filter((a) => a.contactId === id)
        .map((a) => ({
          id: a.id,
          at: a.occurredAt,
          type: a.type as ActivityType | 'stage',
          title: ACTIVITY_LABEL[a.type],
          body: a.summary !== ACTIVITY_LABEL[a.type] ? a.summary : '',
          by: a.createdBy,
        })),
      ...data.stageChanges
        .filter((s) => s.contactId === id)
        .map((s) => ({
          id: s.id,
          at: s.changedAt,
          type: 'stage' as const,
          title: s.fromStage ? `${STAGE_LABEL[s.fromStage]} → ${STAGE_LABEL[s.toStage]}` : `Added as ${STAGE_LABEL[s.toStage]}`,
          body: '',
          by: s.changedBy,
        })),
    ];
    return items
      .filter((x) => {
        if (timelineFilter === 'stages') return x.type === 'stage';
        if (timelineFilter === 'client') return x.type !== 'stage' && CLIENT_TYPES.includes(x.type);
        if (timelineFilter === 'team') return x.type !== 'stage' && !CLIENT_TYPES.includes(x.type);
        return true;
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [data.activities, data.stageChanges, id, timelineFilter]);

  if (!insight) {
    return (
      <div className="page">
        <Empty title="Contact not found">
          They may have been deleted. <Link to="/contacts">Back to contacts</Link>
        </Empty>
      </div>
    );
  }

  const c = insight.contact;
  const eventTypeName = data.eventTypes.find((e) => e.id === c.eventTypeId)?.name ?? 'Event type TBC';
  const current = c.stage === 'lost' ? -1 : stageIndex(c.stage);
  const replyHours = insight.firstReplyAt && insight.enquiredAt ? (insight.firstReplyAt - insight.enquiredAt) / 3600_000 : null;
  const until = daysUntil(c.eventDate);

  const goTo = (s: Stage) => {
    if (s === c.stage) return;
    moveStage(c.id, s);
    toast(`Moved to ${STAGE_LABEL[s]}`);
  };

  const addTag = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const t = newTag.trim();
    if (t && !c.tags.includes(t)) updateContact(c.id, { tags: [...c.tags, t] });
    setNewTag('');
  };

  const whoLabel = (by: string) => (by.startsWith('tm-') ? teamName(by) : by);

  return (
    <div className="page">
      <div>
        <Link to="/contacts" className="small muted">
          ← Contacts
        </Link>
      </div>
      <div className="profile-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="eyebrow">
            {eventTypeName} · {AUDIENCE_LABEL[c.audience]}
          </div>
          <h1 className="profile-name">{fullName(c)}</h1>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusTag stage={c.stage} />
            <Flags insight={insight} />
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => setModal({ kind: 'log', type: 'call' })}>
            <PhoneIcon size={15} /> Log call
          </button>
          <button className="btn" onClick={() => setModal({ kind: 'log', type: 'note' })}>
            <NoteIcon size={15} /> Add note
          </button>
          <button className="btn" onClick={() => setModal({ kind: 'tour' })}>
            <CalendarIcon size={15} /> Book tour
          </button>
          <button className="btn primary" onClick={() => setModal({ kind: 'edit' })}>
            Edit details
          </button>
        </div>
      </div>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card-head" style={{ marginBottom: 0 }}>
          <h2 className="card-title">Journey</h2>
          {c.stage === 'lost' ? (
            <button className="btn small" onClick={() => goTo(c.lostFromStage && c.lostFromStage !== 'lost' ? c.lostFromStage : 'lead')}>
              Reopen
            </button>
          ) : (
            <button className="btn small danger" onClick={() => setModal({ kind: 'lost' })}>
              Mark as lost
            </button>
          )}
        </div>
        {c.stage === 'lost' && (
          <p className="flag bad" style={{ whiteSpace: 'normal', padding: '8px 12px', fontSize: 13 }}>
            Lost at {c.lostFromStage ? STAGE_LABEL[c.lostFromStage] : 'unknown stage'}:{' '}
            {c.lostReason ? LOST_REASON_LABEL[c.lostReason] : 'no reason'}
            {c.lostReasonNote ? `. ${c.lostReasonNote}` : ''}
          </p>
        )}
        <div className={`journey${c.stage === 'lost' ? ' is-lost' : ''}`} role="group" aria-label="Move to stage">
          {JOURNEY.map((s, n) => (
            <button
              key={s}
              type="button"
              className={n === current ? 'current' : n < current ? 'done' : ''}
              aria-current={n === current ? 'step' : undefined}
              onClick={() => goTo(s)}
              title={insight.reachedAt[s] ? `Reached ${formatDateTime(insight.reachedAt[s]!)}` : `Move to ${STAGE_LABEL[s]}`}
            >
              <StageNum stage={s} />
              {STAGE_LABEL[s]}
              <span className="small" style={{ fontWeight: 500, opacity: 0.8 }}>
                {insight.reachedAt[s] ? formatDate(insight.reachedAt[s]!, 'd MMM') : ' '}
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Details</h2>
              <OwnerDot id={c.ownerId} />
            </div>
            <dl className="facts">
              <div>
                <dt>Email</dt>
                <dd>{c.email || '—'}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{c.phone || '—'}</dd>
              </div>
              <div>
                <dt>Event date</dt>
                <dd>
                  {formatDate(c.eventDate)}
                  {until != null && until >= 0 && <span className="muted small"> · in {until} days</span>}
                </dd>
              </div>
              <div>
                <dt>Guests</dt>
                <dd>
                  {c.guestCount ?? '—'}
                  {insight.overCapacity && <span className="muted small"> · second-room conversation</span>}
                </dd>
              </div>
              <div>
                <dt>Estimated value</dt>
                <dd className="num">{formatMoney(c.estimatedValue)}</dd>
              </div>
              <div>
                <dt>Company</dt>
                <dd>{c.company || '—'}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{SOURCE_LABEL[c.source]}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{teamName(c.ownerId)}</dd>
              </div>
              <div>
                <dt>Enquired</dt>
                <dd>{insight.enquiredAt ? formatDateTime(insight.enquiredAt) : 'Not yet'}</dd>
              </div>
              <div>
                <dt>First reply</dt>
                <dd>
                  {replyHours != null ? `${formatHours(replyHours)} after enquiry` : insight.enquiredAt ? 'Not yet' : '—'}
                </dd>
              </div>
            </dl>
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="kpi-label" style={{ fontSize: 11 }}>
                Tags
              </span>
              <div className="tag-editor">
                {c.tags.map((t) => (
                  <span key={t} className={`tag ${t.toLowerCase() === 'hot' ? 'hot' : 'plain'}`}>
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove tag ${t}`}
                      onClick={() => updateContact(c.id, { tags: c.tags.filter((x) => x !== t) })}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  id="tag-new"
                  placeholder="+ Add tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={addTag}
                  aria-label="Add a tag, then press Enter"
                />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Tours</h2>
              <button className="btn small" onClick={() => setModal({ kind: 'tour' })}>
                Book tour
              </button>
            </div>
            {insight.tours.length === 0 ? (
              <p className="muted small">No tours yet.</p>
            ) : (
              <div className="list">
                {[...insight.tours].reverse().map((t) => {
                  const past = new Date(t.scheduledFor).getTime() < Date.now();
                  const leadDays = Math.round((new Date(t.scheduledFor).getTime() - new Date(t.bookedAt).getTime()) / 86_400_000);
                  return (
                    <div className="list-row" key={t.id} style={{ flexWrap: 'wrap' }}>
                      <div className="grow">
                        <div className="title">{formatDateTime(t.scheduledFor)}</div>
                        <div className="meta">
                          Booked {formatDate(t.bookedAt, 'd MMM')} ({leadDays} days ahead) · host {teamName(t.hostId)}
                        </div>
                      </div>
                      {t.status === 'booked' ? (
                        <span style={{ display: 'flex', gap: 6 }}>
                          {past && <span className="flag warn">Needs outcome</span>}
                          <button className="btn small" onClick={() => setTourStatus(t.id, 'attended')}>
                            Attended
                          </button>
                          <button className="btn small" onClick={() => setTourStatus(t.id, 'no_show')}>
                            No-show
                          </button>
                          {!past && (
                            <button className="btn small ghost" onClick={() => setTourStatus(t.id, 'cancelled')}>
                              Cancel
                            </button>
                          )}
                        </span>
                      ) : (
                        <span className={`flag ${t.status === 'attended' ? 'good' : t.status === 'no_show' ? 'bad' : 'warn'}`}>
                          {t.status === 'attended' ? 'Attended' : t.status === 'no_show' ? 'No-show' : 'Cancelled'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {c.stage === 'event_held' && (
            <section className="card">
              <div className="card-head">
                <h2 className="card-title">After the event</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="list-row">
                  <div className="grow">
                    <div className="title">Review request</div>
                    <div className="meta">
                      {c.reviewRequestedAt ? `Asked ${timeAgo(c.reviewRequestedAt)}` : 'Not asked yet. Every client, every time'}
                    </div>
                  </div>
                  {!c.reviewRequestedAt && (
                    <button className="btn small pink" onClick={() => requestReview(c.id)}>
                      Mark as asked
                    </button>
                  )}
                </div>
                {c.reviewRequestedAt && (
                  <label className="list-row" style={{ cursor: 'pointer' }}>
                    <input
                      id="review-received"
                      type="checkbox"
                      checked={c.reviewReceived}
                      onChange={(e) => updateContact(c.id, { reviewReceived: e.target.checked })}
                    />
                    <span className="grow">Review received</span>
                  </label>
                )}
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Privacy</h2>
            </div>
            <p className="small muted" style={{ marginTop: 0 }}>
              If this person asks for their information to be removed, delete them here. This removes their details,
              timeline and tours from the dashboard. It doesn't touch HubSpot or Mailchimp.
            </p>
            {confirmDelete ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="small">Delete {fullName(c)} permanently?</span>
                <button
                  className="btn small danger solid"
                  onClick={() => {
                    deleteContact(c.id);
                    toast(`${fullName(c)} deleted`);
                    navigate('/contacts');
                  }}
                >
                  Yes, delete
                </button>
                <button className="btn small" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </div>
            ) : (
              <button className="btn small danger" onClick={() => setConfirmDelete(true)}>
                Delete contact
              </button>
            )}
          </section>
        </div>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Timeline</h2>
            <div className="segmented" role="group" aria-label="Show">
              {(
                [
                  ['all', 'Everything'],
                  ['team', 'Team'],
                  ['client', 'Client'],
                  ['stages', 'Stages'],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={timelineFilter === k} onClick={() => setTimelineFilter(k)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {timeline.length === 0 ? (
            <p className="muted small">Nothing here yet.</p>
          ) : (
            <ol className="timeline">
              {timeline.map((item) => {
                const Icon = iconFor(item.type);
                const tone = item.type === 'stage' ? 'stage' : CLIENT_TYPES.includes(item.type) ? 'client' : 'team';
                return (
                  <li key={item.id}>
                    <span className={`icon ${tone}`}>
                      <Icon size={16} />
                    </span>
                    <div>
                      <div className="what">{item.title}</div>
                      {item.body && <div>{item.body}</div>}
                      <div className="when">
                        {formatDateTime(item.at)} · {whoLabel(item.by)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {modal?.kind === 'log' && <LogActivityModal contact={c} initialType={modal.type} onClose={() => setModal(null)} />}
      {modal?.kind === 'tour' && <BookTourModal contact={c} onClose={() => setModal(null)} />}
      {modal?.kind === 'edit' && <ContactFormModal contact={c} onClose={() => setModal(null)} />}
      {modal?.kind === 'lost' && <LostModal contact={c} onClose={() => setModal(null)} />}
    </div>
  );
}
