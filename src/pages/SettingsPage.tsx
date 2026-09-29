import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../data/store';
import type { AgreementTemplate, Audience, EventType, ProposalTemplate, Rules, TrackingRule } from '../data/types';
import { AUDIENCES, AUDIENCE_LABEL, DEFAULT_RULES, LOST_REASONS, SOURCES } from '../lib/stages';
import type { EmailTemplate } from '../lib/templates';
import { MAILCHIMP_AUDIENCE, NEWSLETTER_INTERESTS, TAG_RULES } from '../lib/mailchimp';
import { Empty, OwnerDot, useToast } from '../components/ui';

type Tab = 'general' | 'rules' | 'events' | 'templates' | 'proposals' | 'agreements' | 'mailchimp' | 'tracking';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'rules', label: 'Rules' },
  { id: 'events', label: 'Event types' },
  { id: 'templates', label: 'Email templates' },
  { id: 'proposals', label: 'Proposals' },
  { id: 'agreements', label: 'Agreements' },
  { id: 'mailchimp', label: 'Mailchimp' },
  { id: 'tracking', label: 'Website tracking' },
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || `item_${Date.now().toString(36)}`;

export default function SettingsPage() {
  const location = useLocation();
  const initial = (location.state as { tab?: Tab } | null)?.tab ?? 'general';
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.id === initial) ? initial : 'general');
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Only admins can change these once login is switched on</div>
          <h1 className="page-title">Settings</h1>
        </div>
      </div>
      <div className="segmented settings-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'general' && <GeneralTab />}
      {tab === 'rules' && <RulesTab />}
      {tab === 'events' && <EventTypesTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'proposals' && <ProposalTemplatesTab />}
      {tab === 'agreements' && <AgreementTemplatesTab />}
      {tab === 'mailchimp' && <MailchimpTab />}
      {tab === 'tracking' && <TrackingTab />}
    </div>
  );
}

// ---------- General ----------

function GeneralTab() {
  const { data, resetSampleData } = useStore();
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Team</h2>
          <span className="card-note">Sample names. Your real team is added in phase 3</span>
        </div>
        <div className="list">
          {data.team.map((m) => (
            <div className="list-row" key={m.id}>
              <OwnerDot id={m.id} />
              <div className="grow">
                <div className="title">{m.name}</div>
                <div className="meta">{m.email}</div>
              </div>
              <span className="tag plain">{m.role === 'admin' ? 'Admin' : 'Member'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Connections</h2>
        </div>
        <div className="list">
          {[
            ['Gmail (Google Workspace)', 'Send emails from each person’s own Gmail, and show client replies on the timeline'],
            ['Google Calendar', 'Tours and events appear on the calendar and move when they move'],
            ['Mailchimp', `Subscribed contacts, groups and tags go to the ${MAILCHIMP_AUDIENCE} audience. Signups, opens, clicks and unsubscribes come back`],
            ['Website tracking', 'Pages known contacts visit on the Confession website, added to their timeline'],
            ['HubSpot (retiring)', 'One-off import of your existing contacts from a HubSpot export, then HubSpot can be cancelled'],
          ].map(([name, what]) => (
            <div className="list-row" key={name}>
              <div className="grow">
                <div className="title">{name}</div>
                <div className="meta" style={{ whiteSpace: 'normal' }}>
                  {what}
                </div>
              </div>
              <span className="flag warn">Not connected</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Fixed lists</h2>
        </div>
        <dl className="facts">
          <div className="wide-fact">
            <dt>Sources</dt>
            <dd>{SOURCES.map((s) => s.label).join(', ')}</dd>
          </div>
          <div className="wide-fact">
            <dt>Lost reasons</dt>
            <dd>{LOST_REASONS.map((s) => s.label).join(', ')}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Sample data</h2>
        </div>
        <p className="small muted" style={{ marginTop: 0 }}>
          Put the 60 sample contacts and all settings back the way they started. Anything added or changed in this
          browser is cleared.
        </p>
        <button className="btn" onClick={resetSampleData}>
          Reset sample data
        </button>
      </section>
    </div>
  );
}

// ---------- Rules ----------

const RULE_FIELDS: { key: keyof Rules; label: string; unit: string; help: string }[] = [
  { key: 'replyWithinHours', label: 'First reply target', unit: 'hours', help: 'New enquiries without a reply after this long are flagged red' },
  { key: 'followUpDays', label: 'Follow-up after', unit: 'days', help: 'Open leads with no call, email or tour for this long go on the Follow-ups list' },
  { key: 'proposalWithinHours', label: 'Proposal target', unit: 'hours after the tour', help: 'Toured leads without a proposal after this long are flagged' },
  { key: 'altarRoomCapacity', label: 'Altar Room capacity', unit: 'guests', help: 'Enquiries above this get the second-room flag' },
  { key: 'newSignupDays', label: 'New signups stay in New leads for', unit: 'days', help: 'Newsletter and Mailchimp signups nobody has actioned' },
];

function RulesTab() {
  const { data, updateRules } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState<Rules>(data.rules);
  const changed = RULE_FIELDS.some((f) => draft[f.key] !== data.rules[f.key]);
  const valid = RULE_FIELDS.every((f) => Number.isFinite(draft[f.key]) && draft[f.key] > 0);
  return (
    <section className="card" style={{ maxWidth: 820 }}>
      <div className="card-head">
        <h2 className="card-title">Rules</h2>
        <span className="card-note">These drive the flags, lists and report targets everywhere</span>
      </div>
      <div className="rules-list">
        {RULE_FIELDS.map((f) => (
          <label key={f.key} className="rule-row">
            <span className="rule-text">
              <span className="title">{f.label}</span>
              <span className="meta">{f.help}</span>
            </span>
            <span className="rule-input">
              <input
                id={`rule-${f.key}`}
                className="input num"
                type="number"
                min="1"
                value={Number.isFinite(draft[f.key]) ? draft[f.key] : ''}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value === '' ? NaN : Number(e.target.value) })}
              />
              <span className="small muted">{f.unit}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="modal-actions" style={{ marginTop: 16 }}>
        <button className="btn ghost" onClick={() => setDraft({ ...DEFAULT_RULES })}>
          Back to the original rules
        </button>
        <button
          className="btn primary"
          disabled={!changed || !valid}
          onClick={() => {
            updateRules(draft);
            toast('Rules saved');
          }}
        >
          Save rules
        </button>
      </div>
    </section>
  );
}

// ---------- Event types ----------

function EventTypesTab() {
  const { data, saveEventType } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [audience, setAudience] = useState<Audience>('milestone');
  const used = (id: string) => data.contacts.filter((c) => c.eventTypeId === id).length;

  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (data.eventTypes.some((e) => e.name.toLowerCase() === n.toLowerCase())) {
      toast('That event type already exists');
      return;
    }
    let id = slug(n);
    while (data.eventTypes.some((e) => e.id === id)) id += '_2';
    saveEventType({ id, name: n, defaultAudience: audience });
    setName('');
    toast(`${n} added`);
  };

  return (
    <section className="card" style={{ maxWidth: 900 }}>
      <div className="card-head">
        <h2 className="card-title">Event types</h2>
        <span className="card-note">Used on the enquiry form, contacts, reports and Mailchimp tags. Pricing TBC</span>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Event type</th>
              <th>Usual audience</th>
              <th className="r">Contacts</th>
            </tr>
          </thead>
          <tbody>
            {data.eventTypes.map((e) => (
              <EventTypeRow key={e.id} et={e} count={used(e.id)} onSave={(et) => { saveEventType(et); toast('Saved'); }} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="add-row">
        <input id="et-new-name" className="input" placeholder="New event type, e.g. Book launch" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <select id="et-new-aud" className="select" value={audience} onChange={(e) => setAudience(e.target.value as Audience)} aria-label="Usual audience">
          {AUDIENCES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <button className="btn primary" onClick={add} disabled={!name.trim()}>
          Add event type
        </button>
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>
        Renaming keeps every contact and report linked. Event types can't be deleted once contacts use them, so history
        stays accurate.
      </p>
    </section>
  );
}

function EventTypeRow({ et, count, onSave }: { et: EventType; count: number; onSave: (et: EventType) => void }) {
  const [name, setName] = useState(et.name);
  return (
    <tr>
      <td>
        <input
          id={`et-${et.id}`}
          className="input"
          value={name}
          aria-label="Event type name"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== et.name && onSave({ ...et, name: name.trim() })}
        />
      </td>
      <td>
        <select
          id={`et-aud-${et.id}`}
          className="select"
          value={et.defaultAudience}
          aria-label="Usual audience"
          onChange={(e) => onSave({ ...et, defaultAudience: e.target.value as Audience })}
        >
          {AUDIENCES.map((a) => (
            <option key={a.id} value={a.id}>
              {AUDIENCE_LABEL[a.id]}
            </option>
          ))}
        </select>
      </td>
      <td className="r">{count}</td>
    </tr>
  );
}

// ---------- Email templates ----------

const PLACEHOLDERS = [
  ['{{firstName}}', 'Client’s first name'],
  ['{{eventType}}', 'Their event type'],
  ['{{eventDateText}}', '“ on Saturday 3 April” when a date is known'],
  ['{{tourDate}}', 'Their next tour'],
  ['{{senderFirstName}}', 'Your first name'],
];

function TemplatesTab() {
  const { data, saveTemplate, deleteTemplate } = useStore();
  const toast = useToast();
  const [selected, setSelected] = useState(data.templates[0]?.id ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const current = data.templates.find((t) => t.id === selected);
  const [draft, setDraft] = useState<EmailTemplate | null>(current ?? null);

  const pick = (id: string) => {
    setSelected(id);
    setDraft(data.templates.find((t) => t.id === id) ?? null);
    setConfirmDelete(false);
  };

  const addNew = () => {
    const t: EmailTemplate = {
      id: `tpl_${Date.now().toString(36)}`,
      name: 'New template',
      when: 'When to use it',
      subject: '',
      body: 'Hi {{firstName}},\n\n\n\n{{senderFirstName}}',
    };
    saveTemplate(t);
    setSelected(t.id);
    setDraft(t);
  };

  const dirty = draft && current && JSON.stringify(draft) !== JSON.stringify(current);

  return (
    <div className="grid-template-editor">
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Templates</h2>
          <button className="btn small primary" onClick={addNew}>
            + Add
          </button>
        </div>
        <div className="list">
          {data.templates.map((t) => (
            <button key={t.id} type="button" className={`template-item${t.id === selected ? ' active' : ''}`} onClick={() => pick(t.id)}>
              <span className="title">{t.name}</span>
              <span className="meta">{t.when}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        {!draft ? (
          <Empty title="No template selected" />
        ) : (
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input id="tpl-name" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="field">
              <span>When to use it</span>
              <input id="tpl-when" className="input" value={draft.when} onChange={(e) => setDraft({ ...draft, when: e.target.value })} />
            </label>
            <label className="field wide">
              <span>Subject</span>
              <input id="tpl-subject" className="input" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </label>
            <label className="field wide">
              <span>Message</span>
              <textarea id="tpl-body" className="textarea composer-body" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            </label>
            <label className="check wide">
              <input
                id="tpl-review"
                type="checkbox"
                checked={!!draft.asksForGoogleReview}
                onChange={(e) => setDraft({ ...draft, asksForGoogleReview: e.target.checked })}
              />
              Sending this counts as asking for a Google review
            </label>
            <div className="wide placeholder-help">
              <span className="small muted">Fill-ins you can use:</span>
              {PLACEHOLDERS.map(([code, what]) => (
                <span key={code} className="tag plain" title={what}>
                  {code}
                </span>
              ))}
            </div>
            <div className="modal-actions wide">
              {draft.id !== 'blank' &&
                (confirmDelete ? (
                  <>
                    <span className="small">Delete this template?</span>
                    <button
                      className="btn small danger solid"
                      onClick={() => {
                        deleteTemplate(draft.id);
                        const next = data.templates.find((t) => t.id !== draft.id);
                        pick(next?.id ?? '');
                        toast('Template deleted');
                      }}
                    >
                      Yes, delete
                    </button>
                    <button className="btn small" onClick={() => setConfirmDelete(false)}>
                      Keep
                    </button>
                  </>
                ) : (
                  <button className="btn danger" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </button>
                ))}
              <button
                className="btn primary"
                disabled={!dirty || !draft.name.trim()}
                onClick={() => {
                  saveTemplate({ ...draft, name: draft.name.trim() });
                  toast('Template saved');
                }}
              >
                Save template
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- Mailchimp ----------

function MailchimpTab() {
  const { data } = useStore();
  const subscribed = data.contacts.filter((c) => c.marketingConsent === 'subscribed').length;
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">One audience: {MAILCHIMP_AUDIENCE}</h2>
          <span className="flag warn">Not connected</span>
        </div>
        <p className="small" style={{ marginTop: 0 }}>
          Everyone who has agreed to marketing email goes into one Mailchimp audience, sorted with <strong>tags</strong>{' '}
          (what we know about them) and <strong>groups</strong> (what they told us they want). Mailchimp recommends a
          single audience: separate lists mean paying for the same person twice and losing their history. EDMs go to
          segments built from these tags and groups, for example “Persona: Corporate” and “Status: Lead”.
        </p>
        <dl className="facts">
          <div>
            <dt>Would sync today</dt>
            <dd className="num">{subscribed} subscribed contacts</dd>
          </div>
          <div>
            <dt>Never sent</dt>
            <dd>Accessibility needs, notes, emails, values</dd>
          </div>
        </dl>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Unsubscribes and bounces come back and update the contact, so nobody is emailed after opting out.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Groups</h2>
          <span className="card-note">Chosen by people on the newsletter form</span>
        </div>
        <div className="tag-editor">
          {NEWSLETTER_INTERESTS.map((i) => (
            <span key={i} className="tag status-Client">
              {i}
            </span>
          ))}
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Changing these changes the newsletter form, so please speak to Shona or Nic.
        </p>
      </section>

      <section className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="card-head">
          <h2 className="card-title">How tags are worked out</h2>
          <span className="card-note">Kept up to date automatically every hour</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Example</th>
                <th>Comes from</th>
              </tr>
            </thead>
            <tbody>
              {TAG_RULES.map((r) => (
                <tr key={r.family}>
                  <td style={{ fontWeight: 600 }}>{r.family}</td>
                  <td>
                    <span className="tag plain">{r.example}</span>
                  </td>
                  <td>{r.from}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ---------- Website tracking ----------

function TrackingTab() {
  const { data, saveTrackingRule, deleteTrackingRule } = useStore();
  const toast = useToast();
  const [match, setMatch] = useState('');
  const [tag, setTag] = useState('');
  const [alert, setAlert] = useState(false);
  const visits = data.activities.filter((a) => a.type === 'web_visit').length;
  const snippet = `<script src="https://YOUR-DASHBOARD.netlify.app/t.js" defer></script>`;

  const add = () => {
    if (!match.trim() || !tag.trim()) return;
    const r: TrackingRule = { id: `tr-${Date.now().toString(36)}`, match: match.trim(), tag: tag.trim(), alert };
    saveTrackingRule(r);
    setMatch('');
    setTag('');
    setAlert(false);
    toast('Tracking rule added');
  };

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">How it works</h2>
          <span className="flag warn">Not installed</span>
        </div>
        <ol className="steps">
          <li>A small tracking code is added to the Confession website (once, in WordPress).</li>
          <li>It notes which pages each visitor looks at, using a Confession-only cookie.</li>
          <li>
            When a visitor becomes known (they fill in a form, or click a link in an EDM or one of our emails), their
            visits are matched to their contact, including earlier visits on that device.
          </li>
          <li>Visits appear on their timeline, the rules below add tags (which sync to Mailchimp), and alert rules put them on the Follow-ups list.</li>
        </ol>
        <pre className="code">
          <code>{snippet}</code>
        </pre>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Sample data shows {visits} website visits so you can see how they'd look. Anonymous visitors who never become
          known are deleted after 90 days.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Privacy and consent</h2>
        </div>
        <ul className="steps small">
          <li>A cookie notice on the website, with the option to say no. Tracking only starts once they agree.</li>
          <li>The privacy policy explains that website visits and email clicks are linked to enquiries.</li>
          <li>Only page names and times are kept: nothing typed into the site, no location beyond the city.</li>
          <li>Anyone can ask to see or delete their tracking history, and a privacy delete removes it.</li>
          <li>Ad retargeting (Meta, Google) stays in those platforms. This tracking is for our own follow-up.</li>
        </ul>
      </section>

      <section className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="card-head">
          <h2 className="card-title">Interest rules</h2>
          <span className="card-note">When a known contact visits a page whose address contains…</span>
        </div>
        {data.trackingRules.length === 0 ? (
          <Empty title="No rules yet" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Page address contains</th>
                  <th>Add this tag</th>
                  <th>Alert the team</th>
                  <th>
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.trackingRules.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code>{r.match}</code>
                    </td>
                    <td>
                      <span className="tag plain">{r.tag}</span>
                    </td>
                    <td>
                      <label className="check">
                        <input
                          id={`tr-alert-${r.id}`}
                          type="checkbox"
                          checked={r.alert}
                          onChange={(e) => saveTrackingRule({ ...r, alert: e.target.checked })}
                        />
                        {r.alert ? 'Yes' : 'No'}
                      </label>
                    </td>
                    <td className="r">
                      <button className="btn small ghost" onClick={() => deleteTrackingRule(r.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="add-row">
          <input id="tr-new-match" className="input" placeholder="e.g. /functions/christmas" value={match} onChange={(e) => setMatch(e.target.value)} />
          <input id="tr-new-tag" className="input" placeholder="e.g. Browsed: Christmas parties" value={tag} onChange={(e) => setTag(e.target.value)} />
          <label className="check small">
            <input id="tr-new-alert" type="checkbox" checked={alert} onChange={(e) => setAlert(e.target.checked)} />
            Alert the team
          </label>
          <button className="btn primary" onClick={add} disabled={!match.trim() || !tag.trim()}>
            Add rule
          </button>
        </div>
      </section>
    </div>
  );
}

// ---------- Proposal templates ----------

function ProposalTemplatesTab() {
  const { data, saveProposalTemplate } = useStore();
  const toast = useToast();
  const [selected, setSelected] = useState(data.proposalTemplates[0]?.id ?? '');
  const current = data.proposalTemplates.find((t) => t.id === selected);
  const [draft, setDraft] = useState<ProposalTemplate | null>(current ?? null);
  const pick = (id: string) => {
    setSelected(id);
    setDraft(data.proposalTemplates.find((t) => t.id === id) ?? null);
  };
  const addNew = () => {
    const t: ProposalTemplate = {
      id: `pt_${Date.now().toString(36)}`,
      name: 'New proposal template',
      audience: 'milestone',
      headline: 'Your {{eventType}} at Confession',
      intro: '',
      inclusions: '',
      nextSteps: '',
    };
    saveProposalTemplate(t);
    setSelected(t.id);
    setDraft(t);
  };
  const dirty = draft && current && JSON.stringify(draft) !== JSON.stringify(current);
  return (
    <div className="grid-template-editor">
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Proposals</h2>
          <button className="btn small primary" onClick={addNew}>
            + Add
          </button>
        </div>
        <div className="list">
          {data.proposalTemplates.map((t) => (
            <button key={t.id} type="button" className={`template-item${t.id === selected ? ' active' : ''}`} onClick={() => pick(t.id)}>
              <span className="title">{t.name}</span>
              <span className="meta">For {AUDIENCE_LABEL[t.audience]}</span>
            </button>
          ))}
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          The designed PDF layout for each persona will be added when the designs are ready. The words here fill it.
        </p>
      </section>
      <section className="card">
        {!draft ? (
          <Empty title="No template selected" />
        ) : (
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input id="pt-name" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="field">
              <span>Suggested for</span>
              <select id="pt-aud" className="select" value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as Audience })}>
                {AUDIENCES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field wide">
              <span>Headline</span>
              <input id="pt-headline" className="input" value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} />
            </label>
            <label className="field wide">
              <span>Introduction</span>
              <textarea id="pt-intro" className="textarea" value={draft.intro} onChange={(e) => setDraft({ ...draft, intro: e.target.value })} />
            </label>
            <label className="field wide">
              <span>What's included (one per line)</span>
              <textarea id="pt-incl" className="textarea" style={{ minHeight: 130 }} value={draft.inclusions} onChange={(e) => setDraft({ ...draft, inclusions: e.target.value })} />
            </label>
            <label className="field wide">
              <span>Next steps</span>
              <textarea id="pt-next" className="textarea" value={draft.nextSteps} onChange={(e) => setDraft({ ...draft, nextSteps: e.target.value })} />
            </label>
            <div className="wide placeholder-help">
              <span className="small muted">Fill-ins:</span>
              {['{{firstName}}', '{{eventType}}', '{{eventDate}}', '{{company}}', '{{guests}}'].map((p) => (
                <span key={p} className="tag plain">
                  {p}
                </span>
              ))}
            </div>
            <div className="modal-actions wide">
              <button
                className="btn primary"
                disabled={!dirty || !draft.name.trim()}
                onClick={() => {
                  saveProposalTemplate(draft);
                  toast('Proposal template saved');
                }}
              >
                Save template
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- Agreement templates ----------

function AgreementTemplatesTab() {
  const { data, saveAgreementTemplate } = useStore();
  const toast = useToast();
  const [selected, setSelected] = useState(data.agreementTemplates[0]?.id ?? '');
  const current = data.agreementTemplates.find((t) => t.id === selected);
  const [draft, setDraft] = useState<AgreementTemplate | null>(current ?? null);
  const pick = (id: string) => {
    setSelected(id);
    setDraft(data.agreementTemplates.find((t) => t.id === id) ?? null);
  };
  const addNew = () => {
    const t: AgreementTemplate = { id: `at_${Date.now().toString(36)}`, name: 'New agreement', body: current?.body ?? '' };
    saveAgreementTemplate(t);
    setSelected(t.id);
    setDraft(t);
  };
  const dirty = draft && current && JSON.stringify(draft) !== JSON.stringify(current);
  return (
    <div className="grid-template-editor">
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Agreements</h2>
          <button className="btn small primary" onClick={addNew}>
            + Add
          </button>
        </div>
        <div className="list">
          {data.agreementTemplates.map((t) => (
            <button key={t.id} type="button" className={`template-item${t.id === selected ? ' active' : ''}`} onClick={() => pick(t.id)}>
              <span className="title">{t.name}</span>
              <span className="meta">Sent from Finalise booking</span>
            </button>
          ))}
        </div>
        <p className="small flag warn" style={{ whiteSpace: 'normal', padding: '8px 10px', marginBottom: 0 }}>
          Starter text from the Booking Journey Map. Replace it with your lawyer-approved terms before any client sees it.
        </p>
      </section>
      <section className="card">
        {!draft ? (
          <Empty title="No agreement selected" />
        ) : (
          <div className="form-grid">
            <label className="field wide">
              <span>Name</span>
              <input id="at-name" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="field wide">
              <span>Agreement text</span>
              <textarea id="at-body" className="textarea agreement-text" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            </label>
            <div className="wide placeholder-help">
              <span className="small muted">Fill-ins:</span>
              {['{{clientName}}', '{{clientEmail}}', '{{eventType}}', '{{eventDate}}', '{{eventTimes}}', '{{space}}', '{{guests}}'].map((p) => (
                <span key={p} className="tag plain">
                  {p}
                </span>
              ))}
            </div>
            <div className="modal-actions wide">
              <button
                className="btn primary"
                disabled={!dirty || !draft.name.trim()}
                onClick={() => {
                  saveAgreementTemplate(draft);
                  toast('Agreement saved');
                }}
              >
                Save agreement
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
