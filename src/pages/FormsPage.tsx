import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EnquiryForm } from '../components/EnquiryForm';
import { NewsletterForm } from '../components/NewsletterForm';
import { useToast } from '../components/ui';
import { MAILCHIMP_AUDIENCE } from '../lib/mailchimp';

const SITE = 'https://YOUR-DASHBOARD.netlify.app';

type FormKey = 'enquiry' | 'newsletter';

const FORMS: Record<FormKey, { name: string; path: string; height: number; lands: string; mailchimp: string[] }> = {
  enquiry: {
    name: 'Enquiry form',
    path: '/forms/enquiry',
    height: 1250,
    lands: 'New leads on Home, as a Lead',
    mailchimp: [
      `Added to ${MAILCHIMP_AUDIENCE} only if they tick “Keep me posted”`,
      'Tagged with their event type, e.g. Event: Wedding after-party',
      'Tagged with their persona, e.g. Persona: Milestone & Celebration',
      'Tagged Status: Lead and Source: how they heard about us',
    ],
  },
  newsletter: {
    name: 'Disciples newsletter signup',
    path: '/forms/newsletter',
    height: 820,
    lands: 'New leads on Home, as a Prospect',
    mailchimp: [
      `Always added to ${MAILCHIMP_AUDIENCE} (they tick to agree)`,
      'Their ticked interests become Mailchimp groups',
      'Tagged with a persona from their interests',
      'Tagged Status: Prospect and Source: Newsletter form',
    ],
  },
};

export default function FormsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<FormKey>('enquiry');
  const [last, setLast] = useState<{ id: string; name: string } | null>(null);
  const form = FORMS[tab];
  const embed = `<iframe src="${SITE}${form.path}"
  title="${form.name} · Confession"
  style="width:100%;min-height:${form.height}px;border:0"
  loading="lazy"></iframe>`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(embed);
      toast('Embed code copied');
    } catch {
      toast('Copy didn’t work here. Select the code and copy it by hand');
    }
  };

  const sent = (id: string, name: string) => {
    setLast({ id, name });
    toast(`${name || 'New contact'} added to New leads`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Straight into the dashboard and Mailchimp</div>
          <h1 className="page-title">Forms</h1>
        </div>
        <div className="segmented" role="tablist" aria-label="Which form">
          <button role="tab" aria-selected={tab === 'enquiry'} aria-pressed={tab === 'enquiry'} onClick={() => { setTab('enquiry'); setLast(null); }}>
            Enquiry form
          </button>
          <button role="tab" aria-selected={tab === 'newsletter'} aria-pressed={tab === 'newsletter'} onClick={() => { setTab('newsletter'); setLast(null); }}>
            Disciples newsletter
          </button>
        </div>
      </div>

      <div className="grid-3-1" style={{ alignItems: 'start' }}>
        <section className="card ef-frame">
          <div className="card-head">
            <h2 className="card-title">{form.name}</h2>
            <span className="card-note">Try it: it lands in New leads on Home</span>
          </div>
          {tab === 'enquiry' ? <EnquiryForm key="enquiry" onSubmitted={sent} /> : <NewsletterForm key="newsletter" onSubmitted={sent} />}
          {last && (
            <p className="small" style={{ marginBottom: 0 }}>
              Sent. <Link to={`/contacts/${last.id}`}>Open {last.name || 'the new contact'}</Link> or{' '}
              <Link to="/">see it in New leads</Link>.
            </p>
          )}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Where it goes</h2>
            </div>
            <p className="small" style={{ marginTop: 0 }}>
              <strong>Dashboard:</strong> {form.lands}, straight away. A known email address is added to that person's
              record instead of creating a duplicate.
            </p>
            <p className="small" style={{ marginBottom: 6 }}>
              <strong>Mailchimp:</strong>
            </p>
            <ul className="steps small">
              {form.mailchimp.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <p className="small muted" style={{ marginBottom: 0 }}>
              How tags and groups are organised:{' '}
              <Link to="/settings" state={{ tab: 'mailchimp' }}>
                Settings → Mailchimp
              </Link>
            </p>
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Put it on WordPress</h2>
            </div>
            <ol className="steps">
              <li>Edit the page in WordPress.</li>
              <li>
                Add a <strong>Custom HTML</strong> block where the form should go.
              </li>
              <li>Paste the code below and update the page.</li>
            </ol>
            <pre className="code">
              <code>{embed}</code>
            </pre>
            <button className="btn small" onClick={copy}>
              Copy embed code
            </button>
            <p className="small muted">The web address becomes real once the dashboard is on Netlify (phase 4).</p>
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Privacy</h2>
            </div>
            <p className="small" style={{ margin: 0 }}>
              Both forms say why details are collected, and marketing is always a separate, unticked choice.
              Accessibility needs count as sensitive information under the Privacy Act, so they're used only to plan
              the event and never sent to Mailchimp. Link to your privacy policy before the forms go live.
            </p>
          </section>
        </div>
      </div>

      <section className="card form-note">
        <strong>Need a new form, or a change to one?</strong> Please speak to Shona or Nic. Forms connect straight to
        the database and Mailchimp, so they're set up carefully to keep everyone's data sorted. A form builder may be
        added here in the future.
      </section>
    </div>
  );
}
