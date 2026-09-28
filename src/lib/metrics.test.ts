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
