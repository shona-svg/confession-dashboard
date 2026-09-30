// "Work with us" job applications: their own inbox, kept apart from sales contacts.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import type { ApplicationStatus, AttachedFile, JobApplication } from '../data/types';
import { Empty, Modal, useToast } from '../components/ui';
import { APPLICATION_KEEP_MONTHS, APPLICATION_STATUSES, APPLICATION_STATUS_LABEL, JOB_ROLES, fileSize } from '../lib/jobs';
import { formatDate, fullName, timeAgo } from '../lib/format';

type Filter = 'open' | ApplicationStatus | 'all';

export default function ApplicationsPage() {
  const { data } = useStore();
  const [filter, setFilter] = useState<Filter>('open');
  const [role, setRole] = useState('');

  const list = useMemo(
    () =>
      data.applications
        .filter((a) =>
          filter === 'all' ? true : filter === 'open' ? a.status !== 'hired' && a.status !== 'not_suitable' : a.status === filter,
        )
        .filter((a) => !role || a.roles.includes(role))
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [data.applications, filter, role],
  );
  const newCount = data.applications.filter((a) => a.status === 'new').length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">From the Work with us form</div>
          <h1 className="page-title">Job applications</h1>
        </div>
        <Link to="/forms" state={{ tab: 'jobs' }} className="btn small">
          See the form
        </Link>
      </div>

      <div className="filters">
        <div className="segmented" role="group" aria-label="Show">
          {(['open', 'new', 'interview', 'hired', 'all'] as Filter[]).map((k) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {k === 'open' ? 'Open' : k === 'all' ? 'All' : APPLICATION_STATUS_LABEL[k as ApplicationStatus]}
              {k === 'new' && newCount ? ` (${newCount})` : ''}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="app-role">
          Role
        </label>
        <select id="app-role" className="select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          {JOB_ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>

      {list.length === 0 ? (
        <Empty title="No applications here">Try another filter, or share the Work with us form.</Empty>
      ) : (
        <div className="app-grid">
          {list.map((a) => (
            <ApplicationCard key={a.id} a={a} />
          ))}
        </div>
      )}

      <p className="small muted">
        Applications never become sales contacts and are never sent to Mailchimp. Resumes and cover letters are deleted
        automatically {APPLICATION_KEEP_MONTHS} months after they arrive, unless the person is marked Hired.
      </p>
    </div>
  );
}

function ApplicationCard({ a }: { a: JobApplication }) {
  const { updateApplication, deleteApplication } = useStore();
  const toast = useToast();
  const [notes, setNotes] = useState(a.notes);
  const [confirm, setConfirm] = useState(false);
  const name = fullName(a);

  return (
    <article className={`card app-card st-${a.status}`}>
      <header className="app-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="app-name">{name}</h2>
          <div className="small muted" title={formatDate(a.submittedAt)}>
            Applied {timeAgo(a.submittedAt)}
          </div>
        </div>
        <label className="sr-only" htmlFor={`st-${a.id}`}>
          Status for {name}
        </label>
        <select
          id={`st-${a.id}`}
          className="select app-status"
          value={a.status}
          onChange={(e) => {
            updateApplication(a.id, { status: e.target.value as ApplicationStatus });
            toast(`${name}: ${APPLICATION_STATUS_LABEL[e.target.value as ApplicationStatus]}`);
          }}
        >
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {APPLICATION_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </header>

      <div className="tag-row">
        {a.roles.map((r) => (
          <span key={r} className="tag plain">
            {r}
          </span>
        ))}
      </div>

      <dl className="app-contact small">
        <div>
          <dt>Email</dt>
          <dd>
            <a href={`mailto:${a.email}`} className="email-link">
              {a.email}
            </a>
          </dd>
        </div>
        <div>
          <dt>Mobile</dt>
          <dd>
            <a href={`tel:${a.mobile.replace(/\s/g, '')}`}>{a.mobile}</a>
          </dd>
        </div>
      </dl>

      <div className="app-files">
        <FileLink label="Resume" file={a.resume} />
        {a.coverLetter ? <FileLink label="Cover letter" file={a.coverLetter} /> : <span className="small muted">No cover letter</span>}
      </div>

      {a.message && <p className="app-message">{a.message}</p>}

      <label className="field">
        <span>Team notes</span>
        <textarea
          className="textarea"
          rows={2}
          value={notes}
          placeholder="Only the team sees these"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== a.notes && updateApplication(a.id, { notes })}
        />
      </label>

      <div className="app-foot">
        <button type="button" className="link-btn" onClick={() => setConfirm(true)}>
          Delete application
        </button>
      </div>

      {confirm && (
        <Modal title={`Delete ${name}'s application?`} onClose={() => setConfirm(false)}>
          <p>This removes their details, resume and cover letter. It goes to the bin for 30 days first, in case it was a mistake.</p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setConfirm(false)}>
              Keep it
            </button>
            <button
              className="btn danger solid"
              onClick={() => {
                deleteApplication(a.id);
                toast('Application deleted');
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </article>
  );
}

function FileLink({ label, file }: { label: string; file: AttachedFile }) {
  const kind = /\.pdf$/i.test(file.name) ? 'PDF' : 'DOC';
  const body = (
    <>
      <span className="jf-file-icon small" aria-hidden="true">
        {kind}
      </span>
      <span className="jf-file-text">
        <span className="jf-file-name">{label}</span>
        <span className="jf-file-hint">
          {file.name} · {fileSize(file.size)}
        </span>
      </span>
    </>
  );
  return file.url ? (
    <a className="app-file" href={file.url} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    <span className="app-file" title="Sample data: the live version opens the file from private storage">
      {body}
    </span>
  );
}
