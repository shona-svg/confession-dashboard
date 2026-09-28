import { useState, type FormEvent } from 'react';
import { useStore, CURRENT_USER_ID } from '../data/store';
import type { Contact } from '../data/types';
import { TEMPLATES, fillTemplate, suggestedTemplate } from '../lib/templates';
import { formatDateTime, fullName } from '../lib/format';
import { Modal, useToast } from './ui';

/** Write and send a one-to-one email. Live version: sent through the team member's own Gmail. */
export function EmailComposer({ contact, initialTemplate, onClose }: { contact: Contact; initialTemplate?: string; onClose: () => void }) {
  const { data, insights, sendEmail } = useStore();
  const toast = useToast();
  const insight = insights.get(contact.id);
  const eventTypeName = data.eventTypes.find((e) => e.id === contact.eventTypeId)?.name ?? null;
  const [fromId, setFromId] = useState(contact.ownerId ?? CURRENT_USER_ID);
  const sender = data.team.find((m) => m.id === fromId) ?? data.team[0];
  const tourDate = insight?.nextTour ? formatDateTime(insight.nextTour.scheduledFor) : null;

  const start = initialTemplate ?? suggestedTemplate(contact.stage, !!insight?.nextTour, !!insight?.firstReplyAt);
  const fill = (id: string, senderName: string) => {
    const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[TEMPLATES.length - 1];
    const v = { contact, eventTypeName, tourDate, senderName };
    return { subject: fillTemplate(t.subject, v), body: fillTemplate(t.body, v) };
  };
  const [templateId, setTemplateId] = useState(start);
  const [subject, setSubject] = useState(() => fill(start, sender.name).subject);
  const [body, setBody] = useState(() => fill(start, sender.name).body);
  const [touched, setTouched] = useState(false);

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    const f = fill(id, sender.name);
    setSubject(f.subject);
    setBody(f.body);
    setTouched(false);
  };

  const unfilled = /\[[a-z ]+[^\]]*\]/i.test(`${subject}\n${body}`);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = TEMPLATES.find((x) => x.id === templateId);
    sendEmail(contact.id, { fromId, subject: subject.trim(), body, asksForGoogleReview: t?.asksForGoogleReview });
    toast(`Email to ${contact.firstName} saved to the timeline (preview, not actually sent)`);
    onClose();
  };

  return (
    <Modal title={`Email ${fullName(contact)}`} onClose={onClose}>
      <form onSubmit={submit} className="form-grid composer">
        <label className="field">
          <span>From</span>
          <select
            id="em-from"
            className="select"
            value={fromId}
            onChange={(e) => {
              setFromId(e.target.value);
              if (!touched) {
                const s = data.team.find((m) => m.id === e.target.value)!;
                const f = fill(templateId, s.name);
                setSubject(f.subject);
                setBody(f.body);
              }
            }}
          >
            {data.team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.email})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>To</span>
          <input id="em-to" className="input" value={contact.email} readOnly />
        </label>
        <label className="field wide">
          <span>Start from</span>
          <select id="em-template" className="select" value={templateId} onChange={(e) => pickTemplate(e.target.value)}>
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.when}
              </option>
            ))}
          </select>
        </label>
        <label className="field wide">
          <span>Subject</span>
          <input
            id="em-subject"
            className="input"
            required
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setTouched(true);
            }}
          />
        </label>
        <label className="field wide">
          <span>Message</span>
          <textarea
            id="em-body"
            className="textarea composer-body"
            required
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setTouched(true);
            }}
          />
        </label>
        {unfilled && (
          <p className="wide flag warn" style={{ whiteSpace: 'normal', padding: '8px 10px', margin: 0 }}>
            There's still something in [square brackets] to fill in before sending.
          </p>
        )}
        <p className="wide small muted" style={{ margin: 0 }}>
          Preview only: nothing is sent. Once Gmail is connected, this sends from {sender.email}, appears in their Gmail
          Sent folder, and the client's replies show up on this timeline.
        </p>
        <div className="modal-actions wide">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Send email
          </button>
        </div>
      </form>
    </Modal>
  );
}
