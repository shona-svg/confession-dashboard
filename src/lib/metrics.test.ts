import { describe, expect, it } from 'vitest';
import { generateSampleData } from '../data/sampleData';
import { buildInsights, funnel, homeStats, rangeFor, speed, tourStats, weekly } from './metrics';
import { statusOf } from './stages';

const NOW = new Date('2026-09-28T10:00:00').getTime();
const data = generateSampleData(NOW);
const insights = buildInsights(data, NOW);

describe('sample data', () => {
  it('has about 60 contacts across every stage', () => {
    expect(data.contacts).toHaveLength(60);
    const stages = new Set(data.contacts.map((c) => c.stage));
    expect(stages.size).toBe(8);
  });

  it('never puts history in the future, except booked tours', () => {
    for (const a of data.activities) expect(new Date(a.occurredAt).getTime()).toBeLessThanOrEqual(NOW);
    for (const s of data.stageChanges) expect(new Date(s.changedAt).getTime()).toBeLessThanOrEqual(NOW);
    for (const t of data.tours) expect(new Date(t.bookedAt).getTime()).toBeLessThanOrEqual(new Date(t.scheduledFor).getTime());
  });

  it('records a stage change that ends at each contact’s current stage', () => {
    for (const c of data.contacts) {
      const last = data.stageChanges.filter((s) => s.contactId === c.id).at(-1);
      expect(last?.toStage).toBe(c.stage);
    }
  });

  it('has something on every list the team works from', () => {
    const all = [...insights.values()];
    expect(all.filter((i) => i.followUpDue).length).toBeGreaterThan(2);
    expect(all.filter((i) => i.replyOverdue).length).toBeGreaterThan(0);
    expect(data.tours.filter((t) => t.status === 'booked' && new Date(t.scheduledFor).getTime() < NOW).length).toBe(2);
  });
});

describe('events', () => {
  it('never double-books a date and keeps held events in the past', () => {
    const live = data.events.filter((e) => e.status !== 'cancelled');
    expect(new Set(live.map((e) => e.date)).size).toBe(live.length);
    const today = new Date(NOW).toISOString().slice(0, 10);
    for (const e of live) {
      const c = data.contacts.find((x) => x.id === e.contactId)!;
      expect(c.eventDate).toBe(e.date);
      if (c.stage === 'event_held') expect(e.date < today).toBe(true);
      if (c.stage === 'confirmed') expect(e.date >= today).toBe(true);
    }
    expect(live.filter((e) => e.status === 'hold')).toHaveLength(2);
  });
});

describe('new leads', () => {
  it('lists unactioned enquiries and this week’s signups, not everyone', () => {
    const fresh = [...insights.values()].filter((i) => i.isNew);
    expect(fresh.filter((i) => i.contact.stage === 'lead')).toHaveLength(4);
    expect(fresh.every((i) => !i.teamTouched)).toBe(true);
    expect(fresh.length).toBeLessThan(10);
  });

  it('drops a lead once the team has replied', () => {
    const lead = [...insights.values()].find((i) => i.isNew && i.contact.stage === 'lead')!;
    const replied = {
      ...data,
      activities: [
        ...data.activities,
        { id: 'x', contactId: lead.contact.id, type: 'email_out' as const, occurredAt: new Date(NOW).toISOString(), summary: 'Hi', createdBy: 'tm-sam' },
      ],
    };
    expect(buildInsights(replied, NOW).get(lead.contact.id)!.isNew).toBe(false);
  });
});

describe('rules', () => {
  it('derives status from stage', () => {
    expect(statusOf('prospect')).toBe('Prospect');
    expect(statusOf('proposal_sent')).toBe('Lead');
    expect(statusOf('event_held')).toBe('Client');
    expect(statusOf('lost')).toBe('Lost');
  });
});

describe('reports', () => {
  it('produce sensible numbers', () => {
    const all = rangeFor('all', NOW);
    const f = funnel(insights, all);
    const counts = f.steps.map((s) => s.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts); // never increases down the funnel
    expect(counts[0]).toBe(52);
    const w = weekly(data, insights, rangeFor('90d', NOW), NOW);
    expect(w.length).toBeGreaterThanOrEqual(13);
    const s = speed(insights, all);
    expect(s.firstReplyHours).toBeGreaterThan(0);
    const t = tourStats(data, insights, all, NOW);
    expect(t.attended).toBeGreaterThan(10);
    const h = homeStats(data, insights, NOW);
    expect(h.openCount).toBe(28);
    console.log({ counts, speed: s, tours: t, home: h, followUps: [...insights.values()].filter((i) => i.followUpDue).length });
  });
});
