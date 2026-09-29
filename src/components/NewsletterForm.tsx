// The "Confession Disciples" newsletter signup: for people who want to stay in the
// loop but aren't ready to enquire about an event yet. Shown on the Forms page, and on
// its own at /forms/newsletter for embedding in the WordPress site.
import { useState, type FormEvent } from 'react';
import { useStore } from '../data/store';
import { NEWSLETTER_INTERESTS } from '../lib/mailchimp';
import confessionLogo from '../../brand/confession-logo-blue.svg';

export function NewsletterForm({ onSubmitted }: { onSubmitted?: (contactId: string, name: string) => void }) {
  const { submitNewsletter } = useStore();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', website: '' });
  const [interests, setInterests] = useState<string[]>([]);
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const toggle = (i: string) => setInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (f.website || !agree) return; // bots fill the hidden field; consent is required
    const id = submitNewsletter({ firstName: f.firstName, lastName: f.lastName, email: f.email, interests });
    setDone(f.firstName.trim() || 'there');
    onSubmitted?.(id, `${f.firstName} ${f.lastName}`.trim());
    setF({ firstName: '', lastName: '', email: '', website: '' });
    setInterests([]);
    setAgree(false);
  };

  if (done) {
    return (
      <div className="ef ef-done" role="status">
        <img src={confessionLogo} alt="Confession" className="ef-logo" />
        <h2 className="ef-title">Welcome to the flock, {done}</h2>
        <p>You're on the Confession Disciples list. Watch your inbox for news, open dates and the odd confession of our own.</p>
        <button type="button" className="btn" onClick={() => setDone(null)}>
          Sign up someone else
        </button>
      </div>
    );
  }

  return (
    <form className="ef" onSubmit={submit}>
      <img src={confessionLogo} alt="Confession" className="ef-logo" />
      <div>
        <h2 className="ef-title">Join the Confession Disciples</h2>
        <p className="ef-intro">
          Not planning anything just yet? Stay in the loop with open dates, new event ideas and what's happening at the
          church.
        </p>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>First name *</span>
          <input id="nf-first" className="input" required autoComplete="given-name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
        </label>
        <label className="field">
          <span>Last name</span>
          <input id="nf-last" className="input" autoComplete="family-name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
        </label>
        <label className="field wide">
          <span>Email *</span>
          <input id="nf-email" className="input" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
        <fieldset className="field wide" style={{ border: 0, padding: 0, margin: 0 }}>
          <span>What would you like to hear about? (optional)</span>
          <div className="interest-grid">
            {NEWSLETTER_INTERESTS.map((i, n) => (
              <label key={i} className="check">
                <input id={`nf-int-${n}`} type="checkbox" checked={interests.includes(i)} onChange={() => toggle(i)} />
                {i}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="check wide">
          <input id="nf-agree" type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          Yes, email me Confession news and offers. I can unsubscribe any time. *
        </label>
        <label className="ef-hp" aria-hidden="true">
          Leave this empty
          <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
        </label>
      </div>
      <p className="ef-privacy">
        We use your details only to send you Confession emails. We don't share or sell them. See our privacy policy for
        how to access or correct your information.
      </p>
      <button type="submit" className="btn pink ef-submit" disabled={!agree}>
        Join the list
      </button>
    </form>
  );
}
