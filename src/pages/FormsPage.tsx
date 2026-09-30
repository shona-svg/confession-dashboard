import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EnquiryForm } from '../components/EnquiryForm';
import { NewsletterForm } from '../components/NewsletterForm';
import { JobApplicationForm } from '../components/JobApplicationForm';
import { FORM_HEIGHT_MESSAGE } from '../components/PublicFormShell';
import { APPLICATION_KEEP_MONTHS, MAX_FILE_MB } from '../lib/jobs';
import { useToast } from '../components/ui';
import { MAILCHIMP_AUDIENCE } from '../lib/mailchimp';

const SITE = 'https://YOUR-DASHBOARD.netlify.app';

type FormKey = 'enquiry' | 'newsletter' | 'jobs';

interface FormInfo {
  name: string;
  tab: string;
  path: string;
  height: number;
  lands: string;
  mailchimp: string[];
  privacy: string;
}

const MARKETING_PRIVACY =
  "Both sales forms say why details are collected, and marketing is always a separate, unticked choice. Accessibility needs count as sensitive information under the Privacy Act, so they're used only to plan the event and never sent to Mailchimp. Link to your privacy policy before the forms go live.";

const FORMS: Record<FormKey, FormInfo> = {
  enquiry: {
    name: 'Enquiry form',
    tab: 'Enquiry form',
    path: '/forms/enquiry',
    height: 1250,
    lands: 'New leads on Home, as a Lead',
    mailchimp: [
      `Added to ${MAILCHIMP_AUDIENCE} only if they tick “Keep me posted”`,
      'Tagged with their event type, e.g. Event: Wedding after-party',
      'Tagged with their persona, e.g. Persona: Milestone & Celebration',
      'Tagged Status: Lead and Source: how they heard about us',
    ],
    privacy: MARKETING_PRIVACY,
  },
  newsletter: {
    name: 'Disciples newsletter signup',
    tab: 'Disciples newsletter',
    path: '/forms/newsletter',
    height: 820,
    lands: 'New leads on Home, as a Prospect',
    mailchimp: [
      `Always added to ${MAILCHIMP_AUDIENCE} (they tick to agree)`,
      'Their ticked interests become Mailchimp groups',
      'Tagged with a persona from their interests',
      'Tagged Status: Prospect and Source: Newsletter form',
    ],
    privacy: MARKETING_PRIVACY,
  },
  jobs: {
    name: 'Work with us',
    tab: 'Work with us',
    path: '/forms/jointheteam',
    height: 1400,
    lands: 'Job applications, in their own inbox. Never in Contacts or New leads',
    mailchimp: ['Never added. Job applicants are not marketing contacts'],
    privacy: `Resumes hold a lot of personal information, so they're treated carefully. Files are PDF or Word only, up to ${MAX_FILE_MB} MB, and kept in private storage that only logged-in team members can open, one link at a time. They're deleted automatically after ${APPLICATION_KEEP_MONTHS} months unless the person is hired. Everything, files included, is backed up nightly to the restricted Google Drive, encrypted. The form tells applicants all of this before they send.`,
  },
};

export default function FormsPage() {
  const toast = useToast();
  const location = useLocation();
  const [tab, setTab] = useState<FormKey>(((location.state as { tab?: FormKey } | null)?.tab ?? 'enquiry') as FormKey);
  const [last, setLast] = useState<{ id: string; name: string } | null>(null);
  const form = FORMS[tab];
  // The small script lets the frame match the form's height on every screen size.
  const embed = `<iframe src="${SITE}${form.path}" data-confession-form
  title="${form.name} · Confession"
  style="width:100%;height:${form.height}px;border:0;display:block"
  loading="lazy"></iframe>
<script>
addEventListener('message', function (e) {
  if (e.origin !== '${SITE}' || !e.data || e.data.type !== '${FORM_HEIGHT_MESSAGE}') return;
  document.querySelectorAll('iframe[data-confession-form]').forEach(function (f) {
    if (f.contentWindow === e.source) f.style.height = e.data.height + 'px';
  });
});
</script>`;

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
    toast(tab === 'jobs' ? `${name || 'Application'} added to Job applications` : `${name || 'New contact'} added to New leads`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Straight into the dashboard and Mailchimp</div>
          <h1 className="page-title">Forms</h1>
        </div>
        <div className="segmented" role="tablist" aria-label="Which form">
          {(Object.keys(FORMS) as FormKey[]).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => { setTab(k); setLast(null); }}>
              {FORMS[k].tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-3-1" style={{ alignItems: 'start' }}>
        <section className="card ef-frame">
          <div className="card-head">
            <h2 className="card-title">{form.name}</h2>
            <span className="card-note">
              {tab === 'jobs' ? 'Try it: it lands in Job applications' : 'Try it: it lands in New leads on Home'}
            </span>
          </div>
          {tab === 'enquiry' ? (
            <EnquiryForm key="enquiry" onSubmitted={sent} />
          ) : tab === 'newsletter' ? (
            <NewsletterForm key="newsletter" onSubmitted={sent} />
          ) : (
            <JobApplicationForm key="jobs" onSubmitted={sent} />
          )}
          {last && tab === 'jobs' ? (
            <p className="small" style={{ marginBottom: 0 }}>
              Sent. <Link to="/applications">Open Job applications</Link> to see it.
            </p>
          ) : last && (
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
              <strong>Dashboard:</strong> {form.lands}, straight away.
              {tab !== 'jobs' && " A known email address is added to that person's record instead of creating a duplicate."}
            </p>
            <p className="small" style={{ marginBottom: 6 }}>
              <strong>Mailchimp:</strong>
            </p>
            <ul className="steps small">
              {form.mailchimp.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            {tab === 'jobs' ? (
              <p className="small muted" style={{ marginBottom: 0 }}>
                The resume and cover letter go to private file storage, not email, so nothing sits in an inbox.
              </p>
            ) : (
              <p className="small muted" style={{ marginBottom: 0 }}>
                How tags and groups are organised:{' '}
                <Link to="/settings" state={{ tab: 'mailchimp' }}>
                  Settings → Mailchimp
                </Link>
              </p>
            )}
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
            <p className="small muted">
              The code includes a tiny script so the form grows and shrinks to fit phones, tablets and computers,
              with no scrollbar inside the page. The web address becomes real once the dashboard is on Netlify
              (phase 4).
            </p>
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Privacy</h2>
            </div>
            <p className="small" style={{ margin: 0 }}>
              {form.privacy}
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
