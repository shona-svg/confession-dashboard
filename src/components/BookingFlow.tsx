// Proposals and "Finalise booking": the steps from a sent proposal to a LIVE event.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore, CURRENT_USER_ID, type OutgoingEmail } from '../data/store';
import type { Contact, Proposal, ProposalLine, VenueEvent } from '../data/types';
import {
  bookingEvent,
  bookingStep,
  fillBookingText,
  latestProposal,
  proposalTotal,
  suggestedProposalTemplate,
} from '../lib/booking';
import { AUDIENCE_LABEL, RULES, SPACE_LABEL } from '../lib/stages';
import { formatDate, formatDateTime, formatMoney, fullName } from '../lib/format';
import { clashFor, eventTimes } from './bookings';
import { Modal, useToast } from './ui';
import confessionLogo from '../../brand/confession-logo-blue.svg';

// ---------- Shared email fields ----------

function useEmailDraft(contact: Contact, subject: string, body: string) {
  const { data } = useStore();
  const [fromId, setFromId] = useState(contact.ownerId ?? CURRENT_USER_ID);
  const sender = data.team.find((m) => m.id === fromId) ?? data.team[0];
  const sign = (text: string) => text.replace(/\{\{senderFirstName\}\}/g, sender.name.split(' ')[0]);
  const [s, setS] = useState(subject);
  const [b, setB] = useState(body);
  const email: OutgoingEmail = { fromId, subject: sign(s), body: sign(b) };
  const fields = (
    <>
      <label className="field">
        <span>From</span>
        <select id="bf-from" className="select" value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {data.team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.email})
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>To</span>
        <input id="bf-to" className="input" value={contact.email} readOnly />
      </label>
      <label className="field wide">
        <span>Subject</span>
        <input id="bf-subject" className="input" value={s} onChange={(e) => setS(e.target.value)} />
      </label>
      <label className="field wide">
        <span>Message</span>
        <textarea id="bf-body" className="textarea composer-body" style={{ minHeight: 180 }} value={sign(b)} onChange={(e) => setB(e.target.value)} />
      </label>
    </>
  );
  return { email, fields, sender };
}

// ---------- The proposal, as the client sees it ----------

export function ProposalPreview({ proposal, contact }: { proposal: Proposal; contact: Contact }) {
  const { data } = useStore();
  const fill = (t: string) => fillBookingText(t, data, contact);
  const total = proposalTotal(proposal);
  return (
    <article className="proposal-doc">
      <header className="proposal-head">
        <img src={confessionLogo} alt="Confession" />
        <span>Proposal · {formatDate(proposal.sentAt ?? proposal.createdAt, 'd MMMM yyyy')}</span>
      </header>
      <p className="proposal-for">Prepared for {fullName(contact)}{contact.company ? `, ${contact.company}` : ''}</p>
      <h2 className="proposal-title">{fill(proposal.headline)}</h2>
      <p>{fill(proposal.intro)}</p>
      <h3>What's included</h3>
      <ul>
        {proposal.inclusions
          .split('\n')
          .filter((l) => l.trim())
          .map((l) => (
            <li key={l}>{fill(l)}</li>
          ))}
      </ul>
      <h3>Your investment</h3>
      <table className="proposal-lines">
        <tbody>
          {proposal.lines.map((l, i) => (
            <tr key={i}>
              <td>{l.label}</td>
              <td className="r">{l.amount == null ? 'TBC' : formatMoney(l.amount)}</td>
            </tr>
          ))}
          <tr className="total">
            <td>Total</td>
            <td className="r">{formatMoney(total)}</td>
          </tr>
        </tbody>
      </table>
      <h3>Next steps</h3>
      <p>{fill(proposal.nextSteps)}</p>
      <footer className="proposal-foot">CONFESSION · 60 Marryatt Street, Port Adelaide SA 5015</footer>
    </article>
  );
}

// ---------- Prepare, edit and send a proposal ----------

export function ProposalModal({ contact, proposalId, onClose }: { contact: Contact; proposalId?: string; onClose: () => void }) {
  const { data, createProposal, updateProposal, sendProposal } = useStore();
  const toast = useToast();
  const existing = proposalId ? data.proposals.find((p) => p.id === proposalId) : undefined;
  const suggested = suggestedProposalTemplate(data, contact);
  const [templateId, setTemplateId] = useState(existing?.templateId ?? suggested?.id ?? '');
  const tpl = data.proposalTemplates.find((t) => t.id === templateId);
  const [draft, setDraft] = useState<Omit<Proposal, 'id' | 'contactId' | 'status' | 'createdAt' | 'sentAt' | 'acceptedAt'>>(() =>
    existing
      ? { templateId: existing.templateId, headline: existing.headline, intro: existing.intro, inclusions: existing.inclusions, nextSteps: existing.nextSteps, lines: existing.lines }
      : {
          templateId: tpl?.id ?? '',
          headline: tpl?.headline ?? '',
          intro: tpl?.intro ?? '',
          inclusions: tpl?.inclusions ?? '',
          nextSteps: tpl?.nextSteps ?? '',
          lines: [{ label: 'Venue hire and package', amount: contact.estimatedValue }],
        },
  );
  const [step, setStep] = useState<'edit' | 'preview' | 'send'>('edit');
  const eventType = data.eventTypes.find((e) => e.id === contact.eventTypeId)?.name ?? 'event';
  const mail = useEmailDraft(
    contact,
    `Your Confession proposal: ${eventType.toLowerCase()}`,
    `Hi ${contact.firstName},\n\nThanks again for coming in to see the church. Your proposal is attached, built around everything we talked about on the tour.\n\nIf it all looks right, just reply "yes" and we'll send your hire agreement to sign online. Happy to adjust anything.\n\n{{senderFirstName}}\nConfession · 60 Marryatt Street, Port Adelaide`,
  );

  const pickTemplate = (id: string) => {
    const t = data.proposalTemplates.find((x) => x.id === id);
    setTemplateId(id);
    if (t) setDraft((d) => ({ ...d, templateId: t.id, headline: t.headline, intro: t.intro, inclusions: t.inclusions, nextSteps: t.nextSteps }));
  };
  const setLine = (i: number, patch: Partial<ProposalLine>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((l, n) => (n === i ? { ...l, ...patch } : l)) }));

  const save = (): string => {
    if (existing) {
      updateProposal(existing.id, draft);
      return existing.id;
    }
    const id = createProposal(contact.id, tpl ?? data.proposalTemplates[0], draft.lines);
    updateProposal(id, draft);
    return id;
  };

  const previewProposal: Proposal = {
    ...draft,
    id: existing?.id ?? 'draft',
    contactId: contact.id,
    status: existing?.status ?? 'draft',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    sentAt: existing?.sentAt ?? null,
    acceptedAt: existing?.acceptedAt ?? null,
  };

  return (
    <Modal title={existing ? 'Proposal' : 'Prepare a proposal'} onClose={onClose}>
      <div className="segmented" role="tablist" aria-label="Proposal steps">
        {(['edit', 'preview', 'send'] as const).map((s, i) => (
          <button key={s} role="tab" aria-selected={step === s} aria-pressed={step === s} onClick={() => setStep(s)}>
            {i + 1} {s === 'edit' ? 'Edit' : s === 'preview' ? 'Preview' : 'Email it'}
          </button>
        ))}
      </div>

      {step === 'edit' && (
        <div className="form-grid">
          <label className="field wide">
            <span>Template</span>
            <select id="pp-template" className="select" value={templateId} onChange={(e) => pickTemplate(e.target.value)}>
              {data.proposalTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.audience === contact.audience ? '(matches their persona)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="field wide">
            <span>Headline</span>
            <input id="pp-headline" className="input" value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} />
          </label>
          <label className="field wide">
            <span>Introduction</span>
            <textarea id="pp-intro" className="textarea" value={draft.intro} onChange={(e) => setDraft({ ...draft, intro: e.target.value })} />
          </label>
          <label className="field wide">
            <span>What's included (one per line)</span>
            <textarea id="pp-incl" className="textarea" style={{ minHeight: 120 }} value={draft.inclusions} onChange={(e) => setDraft({ ...draft, inclusions: e.target.value })} />
          </label>
          <div className="field wide">
            <span>Pricing (hire fees TBC: type the figures for this client)</span>
            <div className="lines-editor">
              {draft.lines.map((l, i) => (
                <div className="line-row" key={i}>
                  <input id={`pp-line-${i}`} className="input" value={l.label} aria-label="Item" onChange={(e) => setLine(i, { label: e.target.value })} />
                  <input
                    id={`pp-amt-${i}`}
                    className="input num"
                    type="number"
                    min="0"
                    step="50"
                    placeholder="TBC"
                    aria-label="Amount"
                    value={l.amount ?? ''}
                    onChange={(e) => setLine(i, { amount: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                  <button type="button" className="btn small ghost" aria-label="Remove line" onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, n) => n !== i) })}>
                    ×
                  </button>
                </div>
              ))}
              <div className="line-row total-row">
                <button type="button" className="link-btn small" onClick={() => setDraft({ ...draft, lines: [...draft.lines, { label: '', amount: null }] })}>
                  + Add a line
                </button>
                <strong className="num">Total {formatMoney(proposalTotal(draft))}</strong>
              </div>
            </div>
          </div>
          <label className="field wide">
            <span>Next steps</span>
            <textarea id="pp-next" className="textarea" value={draft.nextSteps} onChange={(e) => setDraft({ ...draft, nextSteps: e.target.value })} />
          </label>
          <p className="wide small muted" style={{ margin: 0 }}>
            Fill-ins like {'{{eventType}}'} and {'{{eventDate}}'} are completed from {contact.firstName}'s details. The
            designed PDF layout for each persona will replace this simple layout once it's ready.
          </p>
          <div className="modal-actions wide">
            <button
              className="btn"
              onClick={() => {
                save();
                toast('Proposal saved as a draft');
                onClose();
              }}
            >
              Save draft
            </button>
            <button className="btn primary" onClick={() => setStep('preview')}>
              Preview
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <>
          <ProposalPreview proposal={previewProposal} contact={contact} />
          <div className="modal-actions">
            <button className="btn" onClick={() => setStep('edit')}>
              Back to editing
            </button>
            <button className="btn primary" onClick={() => setStep('send')}>
              Looks good: email it
            </button>
          </div>
        </>
      )}

      {step === 'send' && (
        <div className="form-grid">
          {mail.fields}
          <p className="wide attach-note">Attached: proposal for {fullName(contact)} ({AUDIENCE_LABEL[contact.audience]}) as a PDF</p>
          <p className="wide small muted" style={{ margin: 0 }}>
            Preview only: nothing is sent. Once Gmail is connected this sends from {mail.sender.email} with the PDF attached.
          </p>
          <div className="modal-actions wide">
            <button className="btn" onClick={() => setStep('preview')}>
              Back
            </button>
            <button
              className="btn primary"
              onClick={() => {
                const id = save();
                sendProposal(id, mail.email);
                toast(`Proposal sent to ${contact.firstName} (preview)`);
                onClose();
              }}
            >
              Send proposal
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------- Finalise booking: event details + hire agreement, then email it for signing ----------

export function FinaliseBookingModal({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const { data, finaliseBooking, sendAgreement } = useStore();
  const toast = useToast();
  const ev = bookingEvent(data, contact.id);
  const [step, setStep] = useState<'details' | 'agreement' | 'send'>('details');
  const [f, setF] = useState({
    date: ev?.date ?? contact.eventDate ?? '',
    startTime: ev?.startTime ?? '18:00',
    endTime: ev?.endTime ?? '23:00',
    guestCount: String(ev?.guestCount ?? contact.guestCount ?? ''),
    space: ev?.space ?? (Number(contact.guestCount) > RULES.altarRoomCapacity ? 'altar_room_plus' : 'altar_room'),
    notes: ev?.notes ?? '',
  });
  const [agreementId, setAgreementId] = useState(ev?.agreementTemplateId ?? data.agreementTemplates[0]?.id ?? '');
  const evDraft: Partial<VenueEvent> = { ...f, guestCount: Number(f.guestCount) || null, space: f.space as VenueEvent['space'] };
  const tpl = data.agreementTemplates.find((t) => t.id === agreementId);
  const [agreementText, setAgreementText] = useState(ev?.agreementText ?? '');
  const clash = f.date ? clashFor(data, f.date, ev?.id) : undefined;
  const mail = useEmailDraft(
    contact,
    'Your Confession hire agreement to sign',
    `Hi ${contact.firstName},\n\nWonderful news: let's make it official. Your hire agreement for ${formatDate(f.date, 'EEEE d MMMM')} is ready to review and sign online. It takes about two minutes on your phone or computer:\n\n[Review and sign your agreement]\n\nOnce it's signed we'll send the deposit invoice to lock in your date.\n\n{{senderFirstName}}\nConfession · 60 Marryatt Street, Port Adelaide`,
  );

  const goAgreement = () => {
    if (!agreementText && tpl) setAgreementText(fillBookingText(tpl.body, data, contact, evDraft));
    setStep('agreement');
  };

  return (
    <Modal title="Finalise booking" onClose={onClose}>
      <ol className="flow-steps" aria-label="Steps">
        <li className={step === 'details' ? 'on' : ''}>Event details</li>
        <li className={step === 'agreement' ? 'on' : ''}>Hire agreement</li>
        <li className={step === 'send' ? 'on' : ''}>Email to sign</li>
      </ol>

      {step === 'details' && (
        <div className="form-grid">
          <label className="field wide">
            <span>Event date</span>
            <input id="fb-date" className="input" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </label>
          <label className="field">
            <span>Starts</span>
            <input id="fb-start" className="input" type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
          </label>
          <label className="field">
            <span>Ends</span>
            <input id="fb-end" className="input" type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} />
          </label>
          <label className="field">
            <span>Guests</span>
            <input id="fb-guests" className="input" type="number" min="1" value={f.guestCount} onChange={(e) => setF({ ...f, guestCount: e.target.value })} />
          </label>
          <label className="field">
            <span>Space</span>
            <select id="fb-space" className="select" value={f.space} onChange={(e) => setF({ ...f, space: e.target.value as VenueEvent['space'] })}>
              <option value="altar_room">{SPACE_LABEL.altar_room}</option>
              <option value="altar_room_plus">{SPACE_LABEL.altar_room_plus}</option>
            </select>
          </label>
          {clash && (
            <p className="wide flag bad" style={{ whiteSpace: 'normal', padding: '8px 10px' }}>
              {formatDate(f.date)} already has another event. The venue runs one event at a time.
            </p>
          )}
          <p className="wide small muted" style={{ margin: 0 }}>
            The date is held on the calendar until the deposit is paid.
          </p>
          <div className="modal-actions wide">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={!f.date} onClick={goAgreement}>
              Next: hire agreement
            </button>
          </div>
        </div>
      )}

      {step === 'agreement' && (
        <div className="form-grid">
          <label className="field wide">
            <span>Agreement</span>
            <select
              id="fb-agreement"
              className="select"
              value={agreementId}
              onChange={(e) => {
                setAgreementId(e.target.value);
                const t = data.agreementTemplates.find((x) => x.id === e.target.value);
                if (t) setAgreementText(fillBookingText(t.body, data, contact, evDraft));
              }}
            >
              {data.agreementTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field wide">
            <span>Agreement for {contact.firstName} (edit anything for this client)</span>
            <textarea id="fb-text" className="textarea agreement-text" value={agreementText} onChange={(e) => setAgreementText(e.target.value)} />
          </label>
          <div className="modal-actions wide">
            <button className="btn" onClick={() => setStep('details')}>
              Back
            </button>
            <button className="btn primary" onClick={() => setStep('send')}>
              Next: email it
            </button>
          </div>
        </div>
      )}

      {step === 'send' && (
        <div className="form-grid">
          {mail.fields}
          <p className="wide small muted" style={{ margin: 0 }}>
            The signing link is added automatically. Preview only: nothing is sent.
          </p>
          <div className="modal-actions wide">
            <button className="btn" onClick={() => setStep('agreement')}>
              Back
            </button>
            <button
              className="btn primary"
              onClick={() => {
                const id = finaliseBooking(contact.id, {
                  date: f.date,
                  startTime: f.startTime,
                  endTime: f.endTime,
                  guestCount: Number(f.guestCount) || null,
                  space: f.space as VenueEvent['space'],
                  status: 'hold',
                  notes: f.notes,
                  agreementTemplateId: agreementId,
                  agreementText,
                });
                sendAgreement(id, mail.email);
                toast(`Hire agreement sent to ${contact.firstName} for signing (preview)`);
                onClose();
              }}
            >
              Send agreement for signing
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------- What the client sees when they open the signing link ----------

function SignaturePad({ onChange }: { onChange: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#252466';
  }, []);
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * e.currentTarget.width, ((e.clientY - r.top) / r.height) * e.currentTarget.height] as const;
  };
  return (
    <div className="sig-wrap">
      <canvas
        ref={ref}
        width={560}
        height={140}
        className="sig-pad"
        aria-label="Draw your signature"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext('2d')!;
          const [x, y] = point(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext('2d')!;
          const [x, y] = point(e);
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={(e) => {
          drawing.current = false;
          onChange(e.currentTarget.toDataURL('image/png'));
        }}
      />
      <button
        type="button"
        className="link-btn small"
        onClick={() => {
          const c = ref.current!;
          c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
          onChange('');
        }}
      >
        Clear
      </button>
    </div>
  );
}

export function ClientSigningModal({ contact, eventId, onClose }: { contact: Contact; eventId: string; onClose: () => void }) {
  const { data, signAgreement } = useStore();
  const toast = useToast();
  const ev = data.events.find((e) => e.id === eventId);
  const tpl = data.agreementTemplates.find((t) => t.id === ev?.agreementTemplateId) ?? data.agreementTemplates[0];
  const text = ev?.agreementText || (tpl ? fillBookingText(tpl.body, data, contact, ev) : '');
  const [name, setName] = useState('');
  const [sig, setSig] = useState('');
  const [agree, setAgree] = useState(false);
  if (!ev) return null;
  const signed = !!ev.agreementSignedAt;
  return (
    <Modal title={signed ? 'Signed hire agreement' : 'Client’s view: sign the agreement'} onClose={onClose}>
      {!signed && (
        <p className="small flag warn" style={{ whiteSpace: 'normal', padding: '8px 10px', margin: 0 }}>
          Preview only. In the live system {contact.firstName} opens this from the link in their email.
        </p>
      )}
      <div className="agreement-view">{text}</div>
      {signed ? (
        <div className="signed-block">
          {ev.signatureImage ? <img src={ev.signatureImage} alt={`Signature of ${ev.signedName}`} /> : <p className="sig-typed">{ev.signedName}</p>}
          <p className="small">
            Signed by <strong>{ev.signedName}</strong> on {formatDateTime(ev.agreementSignedAt!)}. The live system also records their email,
            device and a fingerprint of this exact document.
          </p>
        </div>
      ) : (
        <div className="form-grid">
          <label className="field wide">
            <span>Your full name</span>
            <input id="sg-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <div className="field wide">
            <span>Sign here</span>
            <SignaturePad onChange={setSig} />
          </div>
          <label className="check wide">
            <input id="sg-agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I have read and agree to this hire agreement, and I'm happy to sign it electronically.
          </label>
          <div className="modal-actions wide">
            <button className="btn" onClick={onClose}>
              Close
            </button>
            <button
              className="btn pink"
              disabled={!name.trim() || !sig || !agree}
              onClick={() => {
                signAgreement(ev.id, name.trim(), sig);
                toast(`Signed by ${name.trim()}. The team has been alerted`);
                onClose();
              }}
            >
              Sign agreement
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------- Deposit invoice ----------

export function DepositInvoiceModal({ contact, eventId, onClose }: { contact: Contact; eventId: string; onClose: () => void }) {
  const { data, sendDepositInvoice } = useStore();
  const toast = useToast();
  const ev = data.events.find((e) => e.id === eventId);
  const proposal = latestProposal(data, contact.id);
  const [amount, setAmount] = useState(String(ev?.depositAmount ?? proposal?.lines[0]?.amount ?? contact.estimatedValue ?? ''));
  const [link, setLink] = useState(ev?.paymentLink ?? '');
  const mail = useEmailDraft(
    contact,
    'Deposit invoice: your Confession booking',
    `Hi ${contact.firstName},\n\nThank you for signing your hire agreement. Your deposit invoice is attached. Paying it locks in ${ev ? formatDate(ev.date, 'EEEE d MMMM') : 'your date'}.\n\n[Pay your deposit]\n\nThe deposit is credited against your final balance.\n\n{{senderFirstName}}\nConfession · 60 Marryatt Street, Port Adelaide`,
  );
  if (!ev) return null;
  return (
    <Modal title="Send the deposit invoice" onClose={onClose}>
      <div className="form-grid">
        <label className="field">
          <span>Deposit amount ($)</span>
          <input id="di-amount" className="input num" type="number" min="0" step="50" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="field">
          <span>Payment link (optional)</span>
          <input id="di-link" className="input" placeholder="From Xero, Stripe or Square" value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
        <p className="wide small muted" style={{ margin: 0 }}>
          Deposit = the hire fee, credited against the final balance, plus the refundable security bond. Which invoicing
          system to connect is still to be decided.
        </p>
        {mail.fields}
        <div className="modal-actions wide">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => {
              sendDepositInvoice(ev.id, { amount: amount ? Number(amount) : null, paymentLink: link.trim() }, mail.email);
              toast(`Deposit invoice sent to ${contact.firstName} (preview)`);
              onClose();
            }}
          >
            Send invoice
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- The booking progress card on a client's profile ----------

type StepState = 'done' | 'current' | 'upcoming';

export function BookingProgress({ contact }: { contact: Contact }) {
  const { data, acceptProposal, confirmDeposit } = useStore();
  const toast = useToast();
  const [modal, setModal] = useState<null | 'proposal' | 'finalise' | 'sign' | 'invoice'>(null);
  const [confirming, setConfirming] = useState(false);
  const proposal = latestProposal(data, contact.id);
  const ev = bookingEvent(data, contact.id);
  const step = bookingStep(data, contact);
  const live = step === 'live';
  const paperworkEv = ev && ev.agreementSentAt ? ev : undefined;

  const rows: { key: string; title: string; detail: string; state: StepState; action?: ReactNode }[] = [];
  const add = (key: string, title: string, doneAt: string | null | undefined, waiting: string, action?: ReactNode) => {
    const firstOpen = rows.every((r) => r.state === 'done');
    rows.push({
      key,
      title,
      detail: doneAt ? formatDateTime(doneAt) : waiting,
      state: doneAt ? 'done' : firstOpen ? 'current' : 'upcoming',
      action: doneAt ? undefined : firstOpen ? action : undefined,
    });
  };

  add(
    'sent',
    'Proposal sent',
    proposal?.sentAt,
    proposal ? 'Draft ready to send' : `Use the ${AUDIENCE_LABEL[contact.audience]} template`,
    <button className="btn small primary" onClick={() => setModal('proposal')}>
      {proposal ? 'Finish and send' : 'Prepare proposal'}
    </button>,
  );
  add(
    'accepted',
    'Proposal accepted',
    proposal?.acceptedAt ?? (paperworkEv ? paperworkEv.createdAt : null),
    'Waiting to hear back',
    proposal && (
      <button
        className="btn small primary"
        onClick={() => {
          acceptProposal(proposal.id);
          toast(`${contact.firstName} accepted. Next: finalise the booking`);
        }}
      >
        Mark accepted
      </button>
    ),
  );
  add(
    'agreement',
    'Hire agreement sent',
    paperworkEv?.agreementSentAt,
    'Fill in the agreement and email it for signing',
    <button className="btn small pink" onClick={() => setModal('finalise')}>
      Finalise booking
    </button>,
  );
  add(
    'signed',
    'Agreement signed',
    paperworkEv?.agreementSignedAt,
    'Waiting for the client to sign',
    <button className="btn small" onClick={() => setModal('sign')}>
      Client’s view (preview)
    </button>,
  );
  add(
    'invoice',
    'Deposit invoice sent',
    paperworkEv?.depositInvoiceSentAt,
    'Signed: time to send the deposit invoice',
    <button className="btn small primary" onClick={() => setModal('invoice')}>
      Send deposit invoice
    </button>,
  );
  add(
    'paid',
    'Deposit paid: event is LIVE',
    paperworkEv?.depositPaidAt,
    paperworkEv?.depositAmount ? `Waiting for ${formatMoney(paperworkEv.depositAmount)}` : 'Waiting for the deposit',
    confirming ? (
      <span className="inline-confirm">
        <span className="small">Deposit received?</span>
        <button
          className="btn small primary"
          onClick={() => {
            confirmDeposit(paperworkEv!.id);
            setConfirming(false);
            toast(`${contact.firstName}'s event is LIVE and booked`);
          }}
        >
          Yes, it's paid
        </button>
        <button className="btn small" onClick={() => setConfirming(false)}>
          Not yet
        </button>
      </span>
    ) : (
      <button className="btn small primary" onClick={() => setConfirming(true)}>
        Confirm deposit received
      </button>
    ),
  );

  return (
    <section className={`card booking-card${live ? ' is-live' : ''}`}>
      <div className="card-head">
        <h2 className="card-title">Booking</h2>
        {live ? (
          <span className="live-badge">LIVE</span>
        ) : (
          <span className="card-note">Proposal → agreement → deposit → live</span>
        )}
      </div>
      {live && ev && (
        <p className="live-line">
          {formatDate(ev.date, 'EEEE d MMMM yyyy')} · {eventTimes(ev)} · {SPACE_LABEL[ev.space]}
          {ev.guestCount ? ` · ${ev.guestCount} guests` : ''}
        </p>
      )}
      <ol className="booking-steps">
        {rows.map((r) => (
          <li key={r.key} className={`bstep ${r.state}`}>
            <span className="bmark" aria-hidden="true">
              {r.state === 'done' ? '✓' : ''}
            </span>
            <span className="btext">
              <span className="btitle">{r.title}</span>
              <span className="bdetail">{r.detail}</span>
            </span>
            {r.action && <span className="baction">{r.action}</span>}
          </li>
        ))}
      </ol>
      {(proposal || paperworkEv?.agreementSignedAt) && (
        <div className="booking-links">
          {proposal && (
            <button className="link-btn small" onClick={() => setModal('proposal')}>
              View proposal
            </button>
          )}
          {paperworkEv?.agreementSignedAt && (
            <button className="link-btn small" onClick={() => setModal('sign')}>
              View signed agreement
            </button>
          )}
        </div>
      )}
      {modal === 'proposal' && <ProposalModal contact={contact} proposalId={proposal?.id} onClose={() => setModal(null)} />}
      {modal === 'finalise' && <FinaliseBookingModal contact={contact} onClose={() => setModal(null)} />}
      {modal === 'sign' && paperworkEv && <ClientSigningModal contact={contact} eventId={paperworkEv.id} onClose={() => setModal(null)} />}
      {modal === 'invoice' && paperworkEv && <DepositInvoiceModal contact={contact} eventId={paperworkEv.id} onClose={() => setModal(null)} />}
    </section>
  );
}

/** Contacts whose booking needs the team's next move, for Home and Follow-ups. */
export function useBookingTasks() {
  const { data } = useStore();
  const tasks = data.contacts
    .map((c) => ({ contact: c, step: bookingStep(data, c) }))
    .filter((x) => x.step === 'invoice_to_send' || x.step === 'agreement_to_send');
  return tasks;
}

