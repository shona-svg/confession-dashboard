// The "Work with us" job application: the same questions as the current form on
// confessionportadelaide.com/jointheteam, plus a cover letter. Every question is required.
// Shown on the Forms page,
// and on its own at /forms/jointheteam for embedding in the WordPress site.
// Applications go to their own inbox. They never become sales contacts or go to Mailchimp.
import { useId, useRef, useState, type DragEvent, type FormEvent, type RefObject } from 'react';
import { useStore } from '../data/store';
import type { AttachedFile } from '../data/types';
import { APPLICATION_KEEP_MONTHS, FILE_ACCEPT, JOB_ROLES, MAX_FILE_MB, fileProblem, fileSize } from '../lib/jobs';
import confessionLogo from '../../brand/confession-logo-blue.svg';

const EMPTY = { firstName: '', lastName: '', email: '', mobile: '', message: '', website: '' };

export function JobApplicationForm({ onSubmitted }: { onSubmitted?: (id: string, name: string) => void }) {
  const { submitApplication } = useStore();
  const [f, setF] = useState(EMPTY);
  const [roles, setRoles] = useState<string[]>([]);
  const [resume, setResume] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const rolesRef = useRef<HTMLFieldSetElement>(null);
  const resumeRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const toggle = (r: string) => setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  const rolesMissing = tried && roles.length === 0;
  const resumeMissing = tried && !resume;
  const coverMissing = tried && !cover;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (f.website) return; // bots fill the hidden field
    setTried(true);
    if (roles.length === 0) {
      rolesRef.current?.querySelector('input')?.focus();
      return;
    }
    if (!resume) {
      resumeRef.current?.focus();
      return;
    }
    if (!cover) {
      coverRef.current?.focus();
      return;
    }
    if (!f.message.trim()) {
      messageRef.current?.focus();
      return;
    }
    const attach = (file: File): AttachedFile => ({
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
    });
    const id = submitApplication({
      firstName: f.firstName,
      lastName: f.lastName,
      email: f.email,
      mobile: f.mobile,
      roles,
      message: f.message,
      resume: attach(resume),
      coverLetter: attach(cover),
    });
    setDone(f.firstName.trim() || 'there');
    onSubmitted?.(id, `${f.firstName} ${f.lastName}`.trim());
    setF(EMPTY);
    setRoles([]);
    setResume(null);
    setCover(null);
    setTried(false);
  };

  if (done) {
    return (
      <div className="ef ef-done" role="status">
        <img src={confessionLogo} alt="Confession" className="ef-logo" />
        <h2 className="ef-title">Thanks, {done}. Application received</h2>
        <p>We've got your details, resume and cover letter. If your experience is a good fit, someone from the team will be in touch.</p>
        <button type="button" className="btn" onClick={() => setDone(null)}>
          Send another application
        </button>
      </div>
    );
  }

  return (
    <form className="ef" onSubmit={submit}>
      <img src={confessionLogo} alt="Confession" className="ef-logo" />
      <div>
        <h2 className="ef-title">Join our team</h2>
        <p className="ef-intro">
          Thanks for your interest in working at Confession. Tell us a bit about yourself, attach your resume and cover letter, and we'll
          get back to you.
        </p>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>First name *</span>
          <input id="jf-first" className="input" required autoComplete="given-name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
        </label>
        <label className="field">
          <span>Last name *</span>
          <input id="jf-last" className="input" required autoComplete="family-name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
        </label>
        <label className="field">
          <span>Email *</span>
          <input id="jf-email" className="input" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
        <label className="field">
          <span>Mobile *</span>
          <input
            id="jf-mobile"
            className="input"
            type="tel"
            inputMode="tel"
            required
            autoComplete="tel"
            pattern="[0-9+()\s-]{8,}"
            title="A phone number, e.g. 0400 000 000"
            value={f.mobile}
            onChange={(e) => setF({ ...f, mobile: e.target.value })}
          />
        </label>

        <fieldset
          ref={rolesRef}
          className="field wide jf-fieldset"
          aria-describedby={rolesMissing ? 'jf-roles-err' : undefined}
          aria-invalid={rolesMissing || undefined}
        >
          <legend>Which roles are you interested in? *</legend>
          <div className="role-grid">
            {JOB_ROLES.map((r, n) => (
              <label key={r} className={`role-tile${roles.includes(r) ? ' on' : ''}`}>
                <input id={`jf-role-${n}`} type="checkbox" checked={roles.includes(r)} onChange={() => toggle(r)} />
                <span>{r}</span>
              </label>
            ))}
          </div>
          {rolesMissing && (
            <p id="jf-roles-err" className="jf-error" role="alert">
              Please tick at least one role.
            </p>
          )}
        </fieldset>

        <FilePicker
          id="jf-resume"
          label="Resume *"
          file={resume}
          onChange={setResume}
          inputRef={resumeRef}
          missing={resumeMissing && 'Please attach your resume.'}
        />
        <FilePicker
          id="jf-cover"
          label="Cover letter *"
          file={cover}
          onChange={setCover}
          inputRef={coverRef}
          missing={coverMissing && 'Please attach your cover letter.'}
        />

        <label className="field wide">
          <span>Tell us about your experience and availability *</span>
          <textarea
            ref={messageRef}
            id="jf-message"
            className="textarea"
            required
            rows={4}
            placeholder="Availability, licences (RSA, security, first aid), where you've worked before"
            value={f.message}
            onChange={(e) => setF({ ...f, message: e.target.value })}
          />
        </label>
        <label className="ef-hp" aria-hidden="true">
          Leave this empty
          <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
        </label>
      </div>
      <p className="ef-privacy">
        We use your details and documents only to consider you for work at Confession. Only our hiring team can see
        them, we never add you to our mailing list, and we delete them after {APPLICATION_KEEP_MONTHS} months unless you
        join the team. You can ask to see, correct or delete them at any time. See our privacy policy for more.
      </p>
      <button type="submit" className="btn pink ef-submit" onClick={() => setTried(true)}>
        Send application
      </button>
    </form>
  );
}

/** An accessible file chooser: tap to browse on a phone, or drag a file in on a computer. */
function FilePicker({
  id,
  label,
  file,
  onChange,
  inputRef,
  missing,
}: {
  id: string;
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  inputRef?: RefObject<HTMLInputElement>;
  missing?: string | false;
}) {
  const hintId = useId();
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;

  const choose = (picked: File | undefined | null) => {
    if (!picked) return;
    const p = fileProblem(picked);
    setProblem(p);
    onChange(p ? null : picked);
    if (ref.current) ref.current.value = '';
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    choose(e.dataTransfer.files?.[0]);
  };

  const error = problem ?? (missing || null);

  return (
    <div className="field jf-file-field">
      <span id={`${id}-label`}>{label}</span>
      {file ? (
        <div className="jf-file chosen">
          <span className="jf-file-icon" aria-hidden="true">
            {/\.pdf$/i.test(file.name) ? 'PDF' : 'DOC'}
          </span>
          <span className="jf-file-text">
            <span className="jf-file-name">{file.name}</span>
            <span className="jf-file-hint">{fileSize(file.size)}</span>
          </span>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              onChange(null);
              setProblem(null);
            }}
            aria-label={`Remove ${file.name}`}
          >
            Remove
          </button>
        </div>
      ) : (
        <label
          className={`jf-file${over ? ' over' : ''}${error ? ' invalid' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
        >
          <input
            ref={ref}
            id={id}
            type="file"
            className="jf-file-input"
            accept={FILE_ACCEPT}
            aria-labelledby={`${id}-label`}
            aria-describedby={`${hintId}${error ? ` ${id}-err` : ''}`}
            aria-invalid={error ? true : undefined}
            onChange={(e) => choose(e.target.files?.[0])}
          />
          <span className="jf-file-icon" aria-hidden="true">
            +
          </span>
          <span className="jf-file-text">
            <span className="jf-file-name">Choose a file</span>
            <span className="jf-file-hint" id={hintId}>
              PDF or Word, up to {MAX_FILE_MB} MB
            </span>
          </span>
        </label>
      )}
      {error && (
        <p id={`${id}-err`} className="jf-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
