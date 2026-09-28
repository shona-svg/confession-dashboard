// The public enquiry form. It's shown on the Forms page for previewing, and on
// its own at /forms/enquiry so it can be embedded in the WordPress site.
// Phase 3+: submissions go to a Netlify Function that checks for spam and
// saves straight into the database.
import { useState, type FormEvent } from 'react';
import { useStore, type EnquiryInput } from '../data/store';
import type { Source } from '../data/types';
import confessionLogo from '../../brand/confession-logo-blue.svg';

const HEARD_FROM: { id: Source; label: string }[] = [
  { id: 'google', label: 'Google search' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'referral', label: 'A friend, supplier or planner' },
  { id: 'wedding_expo', label: 'A wedding or events expo' },
  { id: 'website_form', label: 'Just browsing the website' },
  { id: 'other', label: 'Somewhere else' },
];

const empty = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  eventTypeId: '',
  eventDate: '',
  flexibleDate: false,
  guestCount: '',
  heardFrom: 'google' as Source,
  accessibilityNeeds: '',
  message: '',
  marketingOptIn: false,
  website: '', // honeypot: people never see or fill this, spam bots do
};

export function EnquiryForm({ onSubmitted }: { onSubmitted?: (contactId: string, name: string) => void }) {
  const { data, submitEnquiry } = useStore();
  const [f, setF] = useState(empty);
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const tick = (k: 'flexibleDate' | 'marketingOptIn') => (e: { target: { checked: boolean } }) =>
    setF((p) => ({ ...p, [k]: e.target.checked }));
  const guests = Number(f.guestCount) || null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (f.website) return; // quietly ignore bots
    const input: EnquiryInput = {
      firstName: f.firstName,
      lastName: f.lastName,
      email: f.email,
      phone: f.phone,
      company: f.company,
      eventTypeId: f.eventTypeId || null,
      eventDate: f.eventDate || null,
      flexibleDate: f.flexibleDate,
      guestCount: guests,
      heardFrom: f.heardFrom,
      accessibilityNeeds: f.accessibilityNeeds,
      message: f.message,
      marketingOptIn: f.marketingOptIn,
    };
    const id = submitEnquiry(input);
    setDone(f.firstName.trim() || 'there');
    onSubmitted?.(id, `${f.firstName} ${f.lastName}`.trim());
    setF(empty);
  };

  if (done) {
    return (
      <div className="ef ef-done" role="status">
        <img src={confessionLogo} alt="Confession" className="ef-logo" />
        <h2 className="ef-title">Thanks, {done}</h2>
        <p>
          We've got your enquiry and a real person will be in touch the same business day, always within 24 hours. The
          best next step is a tour of the church, so bring whoever needs to say yes.
        </p>
        <button type="button" className="btn" onClick={() => setDone(null)}>
          Send another enquiry
        </button>
      </div>
    );
  }

  return (
    <form className="ef" onSubmit={submit} noValidate={false}>
      <img src={confessionLogo} alt="Confession" className="ef-logo" />
      <div>
        <h2 className="ef-title">Plan your night at Confession</h2>
        <p className="ef-intro">
          A reclaimed 1850s church in Port Adelaide, booked exclusively for your event. Tell us a little about it and
          we'll come back to you within 24 hours to arrange a tour.
        </p>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>First name *</span>
          <input id="ef-first" className="input" required autoComplete="given-name" value={f.firstName} onChange={set('firstName')} />
        </label>
        <label className="field">
          <span>Last name *</span>
          <input id="ef-last" className="input" required autoComplete="family-name" value={f.lastName} onChange={set('lastName')} />
        </label>
        <label className="field">
          <span>Email *</span>
          <input id="ef-email" className="input" type="email" required autoComplete="email" value={f.email} onChange={set('email')} />
        </label>
        <label className="field">
          <span>Phone</span>
          <input id="ef-phone" className="input" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} />
        </label>
        <label className="field">
          <span>What are you celebrating? *</span>
          <select id="ef-type" className="select" required value={f.eventTypeId} onChange={set('eventTypeId')}>
            <option value="">Choose one…</option>
            {data.eventTypes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Company (for work events)</span>
          <input id="ef-company" className="input" autoComplete="organization" value={f.company} onChange={set('company')} />
        </label>
        <label className="field">
          <span>Preferred date</span>
          <input id="ef-date" className="input" type="date" value={f.eventDate} onChange={set('eventDate')} />
        </label>
        <label className="field">
          <span>Roughly how many guests?</span>
          <input id="ef-guests" className="input" type="number" min="1" value={f.guestCount} onChange={set('guestCount')} />
        </label>
        <label className="check wide">
          <input id="ef-flex" type="checkbox" checked={f.flexibleDate} onChange={tick('flexibleDate')} />
          My date is flexible
        </label>
        {guests && guests > 150 ? (
          <p className="wide small muted" style={{ margin: 0 }}>
            The Altar Room holds 150. For bigger groups we can talk about adding our second space.
          </p>
        ) : null}
        <label className="field wide">
          <span>Tell us about your night</span>
          <textarea
            id="ef-message"
            className="textarea"
            placeholder="The vibe, must-haves, anything you're picturing"
            value={f.message}
            onChange={set('message')}
          />
        </label>
        <label className="field wide">
          <span>How did you hear about us?</span>
          <select id="ef-heard" className="select" value={f.heardFrom} onChange={set('heardFrom')}>
            {HEARD_FROM.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field wide">
          <span>Accessibility needs</span>
          <textarea
            id="ef-access"
            className="textarea"
            style={{ minHeight: 64 }}
            placeholder="Anything we should know so every guest can enjoy the night (optional)"
            value={f.accessibilityNeeds}
            onChange={set('accessibilityNeeds')}
          />
        </label>
        <label className="check wide">
          <input id="ef-optin" type="checkbox" checked={f.marketingOptIn} onChange={tick('marketingOptIn')} />
          Keep me posted about Confession news and offers (you can unsubscribe any time)
        </label>
        <label className="ef-hp" aria-hidden="true">
          Leave this empty
          <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} />
        </label>
      </div>
      <p className="ef-privacy">
        We collect these details to respond to your enquiry and plan your event. Any accessibility needs are used only to plan your event. We don't share or sell your details. See
        our privacy policy for how to access or correct your information.
      </p>
      <button type="submit" className="btn pink ef-submit">
        Send enquiry
      </button>
    </form>
  );
}
