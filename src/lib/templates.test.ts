import { describe, expect, it } from 'vitest';
import { generateSampleData } from '../data/sampleData';
import { fillTemplate, suggestedTemplate, TEMPLATES } from './templates';
import { mailchimpTags } from './mailchimp';

const data = generateSampleData(new Date('2026-09-28T10:00:00').getTime());
const contact = { ...data.contacts.find((c) => c.stage === 'lead')!, firstName: 'Mia', eventDate: '2027-04-03' };

describe('email templates', () => {
  it('fills in the client and sender, and leaves unknowns in brackets to edit', () => {
    const t = TEMPLATES.find((x) => x.id === 'tour_confirm')!;
    const text = fillTemplate(t.body, { contact, eventTypeName: 'Engagement party', tourDate: null, senderName: 'Sam Porter' });
    expect(text).toContain('Hi Mia,');
    expect(text).toContain('[tour date]');
    expect(text).toContain('\nSam');
    expect(text).not.toContain('{{');
  });

  it('suggests the template that fits the stage', () => {
    expect(suggestedTemplate('lead', false, false)).toBe('first_reply');
    expect(suggestedTemplate('proposal_sent', false, true)).toBe('proposal_follow_up');
    expect(suggestedTemplate('event_held', false, true)).toBe('thank_you');
  });
});

describe('mailchimp tags', () => {
  it('never include accessibility needs', () => {
    const c = { ...contact, accessibilityNeeds: 'Wheelchair access for two guests' };
    expect(mailchimpTags(c, 'Engagement party').join(' ')).not.toContain('Wheelchair');
    expect(mailchimpTags(c, 'Engagement party')).toContain('Lead');
  });
});
