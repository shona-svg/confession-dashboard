import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EnquiryForm } from '../components/EnquiryForm';
import { useToast } from '../components/ui';

const SITE = 'https://YOUR-DASHBOARD.netlify.app';

const EMBED_IFRAME = `<iframe src="${SITE}/forms/enquiry"
  title="Enquire about Confession"
  style="width:100%;min-height:1150px;border:0"
  loading="lazy"></iframe>`;

export default function FormsPage() {
  const toast = useToast();
  const [last, setLast] = useState<{ id: string; name: string } | null>(null);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Embed code copied');
    } catch {
      toast('Copy didn’t work here. Select the code and copy it by hand');
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Enquiries straight into the dashboard</div>
          <h1 className="page-title">Forms</h1>
        </div>
      </div>

      <div className="grid-3-1" style={{ alignItems: 'start' }}>
        <section className="card ef-frame">
          <div className="card-head">
            <h2 className="card-title">Enquiry form</h2>
            <span className="card-note">Try it: it lands in New leads on Home</span>
          </div>
          <EnquiryForm
            onSubmitted={(id, name) => {
              setLast({ id, name });
              toast(`${name || 'New enquiry'} added to New leads`);
            }}
          />
          {last && (
            <p className="small" style={{ marginBottom: 0 }}>
              Sent. <Link to={`/contacts/${last.id}`}>Open {last.name || 'the new lead'}</Link> or{' '}
              <Link to="/">see it in New leads</Link>.
            </p>
          )}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Put it on WordPress</h2>
            </div>
            <ol className="steps">
              <li>Edit the enquiry page in WordPress.</li>
              <li>
                Add a <strong>Custom HTML</strong> block where the form should go.
              </li>
              <li>Paste the code below and update the page.</li>
            </ol>
            <pre className="code">
              <code>{EMBED_IFRAME}</code>
            </pre>
            <button className="btn small" onClick={() => copy(EMBED_IFRAME)}>
              Copy embed code
            </button>
            <p className="small muted">
              The web address becomes real once the dashboard is on Netlify (phase 4). Until then this code is a
              placeholder.
            </p>
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">What happens when someone sends it</h2>
            </div>
            <ol className="steps">
              <li>It appears in New leads straight away, not an hour later.</li>
              <li>If the email is already known, it's added to that person's timeline instead of creating a duplicate.</li>
              <li>“Keep me posted” adds them to Mailchimp (with your go-ahead, phase 6).</li>
              <li>Optionally, a copy goes to HubSpot so its email workflows still run.</li>
              <li>Spam is blocked with a hidden trap field, plus a spam check once it's live.</li>
            </ol>
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Privacy</h2>
            </div>
            <p className="small" style={{ margin: 0 }}>
              The form says why the details are collected, and marketing is opt-in with a separate tick box. For
              accessibility it only asks whether they'd like to talk about it, never about anyone's disability.
              Add a link to your privacy policy before it goes live.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
