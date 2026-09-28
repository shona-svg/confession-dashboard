// Month calendar for the Bookings page. Tours and events can be dragged to
// another day, clicked to open, and an empty spot books something new.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns';
import { useStore } from '../data/store';
import type { Contact, Tour, VenueEvent } from '../data/types';
import { fullName } from '../lib/format';
import { clashFor, toYmd, type BookingRef } from './bookings';
import { useToast } from './ui';

export interface CalendarFilters {
  tours: boolean;
  events: boolean;
  requested: boolean;
}

type Item =
  | { key: string; kind: 'tour'; tour: Tour; contact: Contact; sort: string }
  | { key: string; kind: 'event'; event: VenueEvent; contact: Contact; sort: string; clash: boolean }
  | { key: string; kind: 'requested'; contact: Contact; sort: string };

const narrow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches;

export function BookingCalendar({
  month,
  onMonth,
  selected,
  onSelect,
  filters,
  onOpen,
  onBook,
  onEventClash,
}: {
  month: Date;
  onMonth: (d: Date) => void;
  selected: Date;
  onSelect: (d: Date) => void;
  filters: CalendarFilters;
  onOpen: (b: BookingRef) => void;
  onBook: (d: Date) => void;
  onEventClash: (ev: VenueEvent, date: string, other: VenueEvent) => void;
}) {
  const { data, insights, rescheduleTour, updateEvent } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [dragging, setDragging] = useState<Item | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  // Everything that sits on the calendar, keyed by day.
  const byDay = new Map<string, Item[]>();
  const put = (day: string, item: Item) => byDay.set(day, [...(byDay.get(day) ?? []), item]);
  if (filters.tours) {
    for (const t of data.tours) {
      const contact = insights.get(t.contactId)?.contact;
      if (!contact) continue;
      const d = new Date(t.scheduledFor);
      put(toYmd(d), { key: `tour:${t.id}`, kind: 'tour', tour: t, contact, sort: format(d, 'HH:mm') });
    }
  }
  if (filters.events) {
    for (const ev of data.events) {
      const contact = insights.get(ev.contactId)?.contact;
      if (!contact || ev.status === 'cancelled') continue;
      put(ev.date, {
        key: `event:${ev.id}`,
        kind: 'event',
        event: ev,
        contact,
        sort: ev.startTime,
        clash: !!clashFor(data, ev.date, ev.id),
      });
    }
  }
  if (filters.requested) {
    // Dates open leads have asked about but not booked: handy for spotting demand and clashes.
    const booked = new Set(data.events.filter((e) => e.status !== 'cancelled').map((e) => e.contactId));
    for (const i of insights.values()) {
      if (!i.isOpen || !i.contact.eventDate || booked.has(i.contact.id)) continue;
      put(i.contact.eventDate, { key: `req:${i.contact.id}`, kind: 'requested', contact: i.contact, sort: '99' });
    }
  }
  for (const list of byDay.values()) list.sort((a, b) => a.sort.localeCompare(b.sort));

  const open = (item: Item) => {
    if (item.kind === 'tour') onOpen({ kind: 'tour', tour: item.tour });
    else if (item.kind === 'event') onOpen({ kind: 'event', event: item.event });
    else navigate(`/contacts/${item.contact.id}`);
  };

  const onDragStart = (e: DragStartEvent) => {
    const key = String(e.active.id);
    for (const list of byDay.values()) {
      const found = list.find((x) => x.key === key);
      if (found) setDragging(found);
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    const item = dragging;
    setDragging(null);
    const target = e.over?.id ? String(e.over.id).replace('day:', '') : null;
    if (!item || !target) return;
    const today = toYmd(new Date());
    if (target < today) {
      toast('Bookings can’t be moved into the past');
      return;
    }
    if (item.kind === 'tour') {
      const from = new Date(item.tour.scheduledFor);
      if (toYmd(from) === target) return;
      const to = new Date(target + 'T00:00:00');
      to.setHours(from.getHours(), from.getMinutes(), 0, 0);
      rescheduleTour(item.tour.id, to.toISOString(), item.tour.hostId);
      toast(`${item.contact.firstName}'s tour moved to ${format(to, 'EEE d MMM, h:mmaaa')}`);
    } else if (item.kind === 'event') {
      if (item.event.date === target) return;
      const other = clashFor(data, target, item.event.id);
      if (other) {
        onEventClash(item.event, target, other);
        return;
      }
      updateEvent(item.event.id, { date: target });
      toast(`${item.contact.firstName}'s event moved to ${format(new Date(target + 'T12:00:00'), 'EEE d MMM')}`);
    }
  };

  return (
    <div className="cal">
      <div className="cal-head">
        <h2 className="card-title">{format(month, 'MMMM yyyy')}</h2>
        <div className="page-actions">
          <button className="btn small" onClick={() => onMonth(addMonths(month, -1))} aria-label="Previous month">
            ←
          </button>
          <button
            className="btn small"
            onClick={() => {
              onMonth(startOfMonth(new Date()));
              onSelect(new Date());
            }}
          >
            Today
          </button>
          <button className="btn small" onClick={() => onMonth(addMonths(month, 1))} aria-label="Next month">
            →
          </button>
        </div>
      </div>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="cal-grid" role="grid" aria-label={format(month, 'MMMM yyyy')}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="cal-dow" role="columnheader">
              {d}
            </div>
          ))}
          {days.map((d) => (
            <Day
              key={d.toISOString()}
              day={d}
              items={byDay.get(toYmd(d)) ?? []}
              inMonth={isSameMonth(d, month)}
              selected={isSameDay(d, selected)}
              onSelect={() => {
                onSelect(d);
                if (!isSameMonth(d, month)) onMonth(startOfMonth(d));
              }}
              onBook={() => {
                onSelect(d);
                if (narrow()) return; // on a phone, a tap shows the day below instead
                onBook(d);
              }}
              onOpen={open}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{dragging ? <Chip item={dragging} overlay /> : null}</DragOverlay>
      </DndContext>
      <div className="legend cal-legend">
        <span>
          <i className="swatch" style={{ background: 'var(--accent-soft)', outline: '1px solid var(--accent)' }} /> Tour
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--navy)' }} /> Event
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--warn-bg)', outline: '1px dashed var(--warn)' }} /> Event on hold
        </span>
        {filters.requested && (
          <span>
            <i className="swatch" style={{ outline: '1px dashed var(--line-strong)' }} /> Date requested
          </span>
        )}
        <span className="muted">Drag to move · click to open · click an empty spot to book</span>
      </div>
    </div>
  );
}

function Day({
  day,
  items,
  inMonth,
  selected,
  onSelect,
  onBook,
  onOpen,
}: {
  day: Date;
  items: Item[];
  inMonth: boolean;
  selected: boolean;
  onSelect: () => void;
  onBook: () => void;
  onOpen: (item: Item) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${toYmd(day)}` });
  const past = toYmd(day) < toYmd(new Date());
  const hasClash = items.some((i) => i.kind === 'event' && i.clash);
  const cls = [
    'cal-day',
    inMonth ? '' : 'other',
    isToday(day) ? 'today' : '',
    selected ? 'selected' : '',
    isOver ? (past ? 'drop-bad' : 'drop-ok') : '',
    hasClash ? 'clash' : '',
    past ? 'past' : '',
  ].join(' ');
  const visible = items.slice(0, 4);
  return (
    <div ref={setNodeRef} className={cls} role="gridcell" aria-selected={selected} onClick={onBook}>
      <div className="cal-day-top">
        <button
          type="button"
          className="cal-num"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          aria-label={`${format(day, 'EEEE d MMMM')}: ${items.length} bookings. Show this day`}
        >
          {format(day, 'd')}
        </button>
        {!past && (
          <button
            type="button"
            className="cal-add"
            onClick={(e) => {
              e.stopPropagation();
              onBook();
            }}
            aria-label={`Book something on ${format(day, 'd MMMM')}`}
          >
            +
          </button>
        )}
      </div>
      <div className="cal-chips">
        {visible.map((item) => (
          <DraggableChip key={item.key} item={item} onOpen={onOpen} />
        ))}
        {items.length > visible.length && (
          <button
            type="button"
            className="cal-more"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            +{items.length - visible.length} more
          </button>
        )}
      </div>
      {items.length > 0 && (
        <span className="cal-dot" aria-hidden="true">
          {items.length}
        </span>
      )}
    </div>
  );
}

function DraggableChip({ item, onOpen }: { item: Item; onOpen: (i: Item) => void }) {
  const movable =
    (item.kind === 'tour' && item.tour.status === 'booked') || (item.kind === 'event' && item.event.status !== 'cancelled');
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.key, disabled: !movable });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...(movable ? { ...listeners, ...attributes } : {})}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(item);
      }}
      className="chip-btn"
      style={{ opacity: isDragging ? 0.35 : 1 }}
      aria-label={chipLabel(item, movable)}
    >
      <Chip item={item} />
    </button>
  );
}

function chipLabel(item: Item, movable: boolean): string {
  const name = fullName(item.contact);
  const hint = movable ? 'Open or drag to move' : 'Open';
  if (item.kind === 'tour') return `Tour: ${name}, ${format(new Date(item.tour.scheduledFor), 'h:mmaaa')}. ${hint}`;
  if (item.kind === 'event') return `Event: ${name}, ${item.event.status === 'hold' ? 'on hold' : 'confirmed'}. ${hint}`;
  return `Date requested by ${name}`;
}

function Chip({ item, overlay = false }: { item: Item; overlay?: boolean }) {
  if (item.kind === 'tour') {
    return (
      <span className={`cal-chip status-${item.tour.status}${overlay ? ' overlay' : ''}`}>
        <b>{format(new Date(item.tour.scheduledFor), 'h:mm')}</b> {item.contact.firstName}
      </span>
    );
  }
  if (item.kind === 'event') {
    return (
      <span className={`cal-chip ev ev-${item.event.status}${item.clash ? ' ev-clash' : ''}${overlay ? ' overlay' : ''}`}>
        <b>Event</b> {item.contact.firstName} {item.contact.lastName[0] ?? ''}
      </span>
    );
  }
  return (
    <span className="cal-chip requested">
      <b>Req</b> {item.contact.firstName}
    </span>
  );
}
