import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useStore } from '../data/store';
import type { Contact, Stage } from '../data/types';
import { ALL_STAGES, AUDIENCES, STAGE_HINT, STAGE_LABEL } from '../lib/stages';
import type { Insight } from '../lib/metrics';
import { formatDate, formatMoney, formatMoneyShort, fullName } from '../lib/format';
import { Flags, OwnerDot, StageNum, Tags, useToast } from '../components/ui';
import { LostModal } from '../components/modals';
import { sum } from '../lib/metrics';
import { EmailButton } from '../components/EmailComposer';
import { BOOKING_STEP_LABEL, bookingStep } from '../lib/booking';

export default function PipelinePage() {
  const { data, insights, moveStage } = useStore();
  const toast = useToast();
  const [eventType, setEventType] = useState('');
  const [owner, setOwner] = useState('');
  const [audience, setAudience] = useState('');
  const [search, setSearch] = useState('');
  const [showProspects, setShowProspects] = useState(true);
  const [dragging, setDragging] = useState<Contact | null>(null);
  const [losing, setLosing] = useState<Contact | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.contacts.filter(
      (c) =>
        (!eventType || c.eventTypeId === eventType) &&
        (!owner || (owner === 'none' ? !c.ownerId : c.ownerId === owner)) &&
        (!audience || c.audience === audience) &&
        (!q || `${c.firstName} ${c.lastName} ${c.company} ${c.email}`.toLowerCase().includes(q)),
    );
  }, [data.contacts, eventType, owner, audience, search]);

  const stages = ALL_STAGES.filter((s) => showProspects || s !== 'prospect');

  const onDragStart = (e: DragStartEvent) => {
    setDragging(data.contacts.find((c) => c.id === e.active.id) ?? null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const to = e.over?.id as Stage | undefined;
    const c = data.contacts.find((x) => x.id === e.active.id);
    if (!to || !c || c.stage === to) return;
    if (to === 'lost') {
      setLosing(c);
      return;
    }
    moveStage(c.id, to);
    toast(`${fullName(c)} moved to ${STAGE_LABEL[to]}`);
  };

  const typeName = (id: string | null) => data.eventTypes.find((e) => e.id === id)?.name ?? 'Event TBC';

  return (
    <div className="page" style={{ maxWidth: 'none' }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Drag a card to move it along the journey</div>
          <h1 className="page-title">Pipeline</h1>
        </div>
      </div>

      <div className="filters">
        <input
          id="pl-search"
          className="input"
          type="search"
          placeholder="Search name or company"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search"
        />
        <select id="pl-type" className="select" value={eventType} onChange={(e) => setEventType(e.target.value)} aria-label="Event type">
          <option value="">All event types</option>
          {data.eventTypes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <select id="pl-owner" className="select" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
          <option value="">All owners</option>
          {data.team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
          <option value="none">Unassigned</option>
        </select>
        <select id="pl-aud" className="select" value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Audience">
          <option value="">All audiences</option>
          {AUDIENCES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <label className="small" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <input id="pl-prospects" type="checkbox" checked={showProspects} onChange={(e) => setShowProspects(e.target.checked)} />
          Show prospects
        </label>
        {(eventType || owner || audience || search) && (
          <button
            className="link-btn small"
            onClick={() => {
              setEventType('');
              setOwner('');
              setAudience('');
              setSearch('');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="board">
          {stages.map((stage) => {
            const cards = filtered
              .filter((c) => c.stage === stage)
              .sort((a, b) => sortKey(stage, a, b));
            return (
              <Column key={stage} stage={stage} cards={cards}>
                {cards.map((c) => (
                  <Card key={c.id} contact={c} insight={insights.get(c.id)!} typeName={typeName(c.eventTypeId)} />
                ))}
              </Column>
            );
          })}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragging ? (
            <CardBody contact={dragging} insight={insights.get(dragging.id)!} typeName={typeName(dragging.eventTypeId)} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>
      <p className="board-hint">
        Every move is recorded with the date, for the speed reports. Moving to Lost asks for a reason. Confirmed
        events move to Event held automatically the day after.
      </p>

      {losing && <LostModal contact={losing} onClose={() => setLosing(null)} />}
    </div>
  );
}

function sortKey(stage: Stage, a: Contact, b: Contact): number {
  if (stage === 'confirmed' || stage === 'event_held') {
    const dir = stage === 'event_held' ? -1 : 1;
    return dir * (a.eventDate ?? '').localeCompare(b.eventDate ?? '');
  }
  return b.createdAt.localeCompare(a.createdAt);
}

function Column({ stage, cards, children }: { stage: Stage; cards: Contact[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const value = sum(cards.map((c) => c.estimatedValue));
  return (
    <section
      ref={setNodeRef}
      className={`column${stage === 'lost' ? ' lost-col' : ''}${isOver ? ' over' : ''}`}
      aria-label={`${STAGE_LABEL[stage]}: ${cards.length}`}
    >
      <header className="column-head" title={STAGE_HINT[stage]}>
        <div className="row">
          <StageNum stage={stage} />
          <span className="name">{STAGE_LABEL[stage]}</span>
          <span className="count">{cards.length}</span>
        </div>
        <span className="value">{value ? formatMoneyShort(value) : STAGE_HINT[stage]}</span>
      </header>
      <div className="column-body">{children}</div>
    </section>
  );
}

function Card(props: { contact: Contact; insight: Insight; typeName: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.contact.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} aria-roledescription="Draggable contact card">
      <CardBody {...props} dragging={isDragging} />
    </div>
  );
}

function CardBody({
  contact: c,
  insight,
  typeName,
  dragging,
  overlay,
}: {
  contact: Contact;
  insight: Insight;
  typeName: string;
  dragging?: boolean;
  overlay?: boolean;
}) {
  return (
    <article className={`deal${dragging ? ' dragging' : ''}${overlay ? ' overlay' : ''}`}>
      <div className="top">
        <Link to={`/contacts/${c.id}`} className="who" onPointerDown={(e) => e.stopPropagation()}>
          {fullName(c)}
        </Link>
        <OwnerDot id={c.ownerId} />
      </div>
      <div className="what">
        {typeName}
        {c.company ? ` · ${c.company}` : ''}
        <br />
        {c.eventDate ? formatDate(c.eventDate, 'EEE d MMM yyyy') : 'Date TBC'}
        {c.guestCount ? ` · ${c.guestCount} guests` : ''}
      </div>
      {(c.tags.length > 0 || insight) && (
        <div className="flags">
          <Tags tags={c.tags} />
          {c.stage === 'lost' && c.lostReason ? null : <Flags insight={insight} compact />}
          <BookingChip contact={c} />
        </div>
      )}
      <div className="bottom">
        <span className="num">{formatMoney(c.estimatedValue)}</span>
        {insight.nextTour && c.stage === 'tour_booked' && (
          <span>Tour {formatDate(insight.nextTour.scheduledFor, 'd MMM')}</span>
        )}
        {!overlay && <EmailButton contact={c} compact />}
      </div>
    </article>
  );
}

function BookingChip({ contact }: { contact: Contact }) {
  const { data } = useStore();
  if (contact.stage !== 'finalising') return null;
  const step = bookingStep(data, contact);
  if (!step) return null;
  const urgent = step === 'invoice_to_send' || step === 'agreement_to_send';
  return <span className={`flag ${urgent ? 'bad' : 'warn'}`}>{BOOKING_STEP_LABEL[step]}</span>;
}
