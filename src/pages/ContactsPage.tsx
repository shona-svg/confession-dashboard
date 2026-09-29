import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import { ALL_STAGES, AUDIENCES, SOURCES, SOURCE_LABEL, STAGE_LABEL, STATUSES, statusOf } from '../lib/stages';
import { formatDate, formatMoney, fullName, timeAgo } from '../lib/format';
import { Empty, Flags, OwnerDot, StatusTag, Tags } from '../components/ui';
import { ContactFormModal } from '../components/modals';
import { PlusIcon } from '../components/Icons';
import { EmailButton } from '../components/EmailComposer';

type SortKey = 'name' | 'created' | 'eventDate' | 'value' | 'lastContact';

export default function ContactsPage() {
  const { data, insights } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [stage, setStage] = useState('');
  const [eventType, setEventType] = useState('');
  const [source, setSource] = useState('');
  const [owner, setOwner] = useState('');
  const [audience, setAudience] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'created', dir: -1 });
  const [adding, setAdding] = useState(false);

  const allTags = useMemo(() => [...new Set(data.contacts.flatMap((c) => c.tags))].sort(), [data.contacts]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = [...insights.values()].filter(({ contact: c }) => {
      if (needle && !`${c.firstName} ${c.lastName} ${c.email} ${c.company} ${c.phone}`.toLowerCase().includes(needle)) return false;
      if (status && statusOf(c.stage) !== status) return false;
      if (stage && c.stage !== stage) return false;
      if (eventType && c.eventTypeId !== eventType) return false;
      if (source && c.source !== source) return false;
      if (owner && c.ownerId !== owner) return false;
      if (audience && c.audience !== audience) return false;
      if (tag && !c.tags.includes(tag)) return false;
      return true;
    });
    const val = (i: (typeof list)[number]): string | number => {
      switch (sort.key) {
        case 'name':
          return fullName(i.contact).toLowerCase();
        case 'eventDate':
          return i.contact.eventDate ?? '9999';
        case 'value':
          return i.contact.estimatedValue ?? -1;
        case 'lastContact':
          return i.lastContactAt ?? 0;
        default:
          return i.contact.createdAt;
      }
    };
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [insights, q, status, stage, eventType, source, owner, audience, tag, sort]);

  const th = (key: SortKey, label: string, right = false) => (
    <th className={right ? 'r' : undefined} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'name' ? 1 : -1 }))}>
        {label} {sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : ''}
      </button>
    </th>
  );

  const filtering = q || status || stage || eventType || source || owner || audience || tag;
  const typeName = (id: string | null) => data.eventTypes.find((e) => e.id === id)?.name ?? '—';

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{rows.length} of {data.contacts.length} contacts</div>
          <h1 className="page-title">Contacts</h1>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setAdding(true)}>
            <PlusIcon size={16} /> New enquiry
          </button>
        </div>
      </div>

      <div className="filters">
        <input id="ct-q" className="input" type="search" placeholder="Search name, email, phone, company" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" style={{ minWidth: 240 }} />
        <select id="ct-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select id="ct-stage" className="select" value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage">
          <option value="">All stages</option>
          {ALL_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
        <select id="ct-type" className="select" value={eventType} onChange={(e) => setEventType(e.target.value)} aria-label="Event type">
          <option value="">All event types</option>
          {data.eventTypes.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select id="ct-source" className="select" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select id="ct-owner" className="select" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
          <option value="">All owners</option>
          {data.team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select id="ct-aud" className="select" value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Audience">
          <option value="">All audiences</option>
          {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <select id="ct-tag" className="select" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag">
          <option value="">All tags</option>
          {allTags.map((t) => <option key={t}>{t}</option>)}
        </select>
        {filtering && (
          <button className="link-btn small" onClick={() => { setQ(''); setStatus(''); setStage(''); setEventType(''); setSource(''); setOwner(''); setAudience(''); setTag(''); }}>
            Clear filters
          </button>
        )}
      </div>

      <section className="card" style={{ padding: '8px 16px' }}>
        {rows.length === 0 ? (
          <Empty title="No one matches">Try clearing a filter.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  {th('name', 'Name')}
                  <th>Status</th>
                  <th>Stage</th>
                  <th>Event</th>
                  {th('eventDate', 'Event date')}
                  <th className="r">Guests</th>
                  {th('value', 'Est. value', true)}
                  <th>Source</th>
                  <th>Owner</th>
                  {th('lastContact', 'Last contact')}
                  <th><span className="sr-only">Email</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => {
                  const c = i.contact;
                  return (
                    <tr key={c.id} className="clickable" onClick={() => navigate(`/contacts/${c.id}`)}>
                      <td>
                        <div className="name-cell">
                          <Link to={`/contacts/${c.id}`} onClick={(e) => e.stopPropagation()}>
                            {fullName(c)}
                          </Link>
                          <span className="small muted">{c.company || c.email}</span>
                          {(c.tags.length > 0 || i.replyOverdue || i.followUpDue || i.proposalOverdue) && (
                            <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                              <Tags tags={c.tags} />
                              <Flags insight={i} compact />
                            </span>
                          )}
                        </div>
                      </td>
                      <td><StatusTag stage={c.stage} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{STAGE_LABEL[c.stage]}</td>
                      <td>{typeName(c.eventTypeId)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(c.eventDate, 'd MMM yyyy')}</td>
                      <td className="r">{c.guestCount ?? '—'}</td>
                      <td className="r">{formatMoney(c.estimatedValue)}</td>
                      <td>{SOURCE_LABEL[c.source]}</td>
                      <td><OwnerDot id={c.ownerId} /></td>
                      <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
                        {i.lastContactAt ? timeAgo(i.lastContactAt) : '—'}
                      </td>
                      <td>
                        <EmailButton contact={c} compact />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {adding && <ContactFormModal onClose={() => setAdding(false)} onSaved={(id) => navigate(`/contacts/${id}`)} />}
    </div>
  );
}
