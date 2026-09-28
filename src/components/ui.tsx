import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Stage } from '../data/types';
import { statusOf, STAGE_LABEL, stageIndex } from '../lib/stages';
import { initials } from '../lib/format';
import type { Insight } from '../lib/metrics';
import { useTeamName } from '../data/store';

export function StatusTag({ stage }: { stage: Stage }) {
  const status = statusOf(stage);
  return <span className={`tag status-${status}`}>{status}</span>;
}

export function StageNum({ stage }: { stage: Stage }) {
  if (stage === 'lost') return null;
  return <span className="stage-num">{String(stageIndex(stage) + 1).padStart(2, '0')}</span>;
}

export function StageLabel({ stage }: { stage: Stage }) {
  return <span>{STAGE_LABEL[stage]}</span>;
}

export function OwnerDot({ id }: { id: string | null }) {
  const name = useTeamName()(id);
  return (
    <span className="owner-dot" title={name} aria-label={`Owner: ${name}`}>
      {id ? initials(name) : '—'}
    </span>
  );
}

export function Tags({ tags }: { tags: string[] }) {
  return (
    <>
      {tags.map((t) => (
        <span key={t} className={`tag ${t.toLowerCase() === 'hot' ? 'hot' : 'plain'}`}>
          {t}
        </span>
      ))}
    </>
  );
}

/** Attention flags on a contact, in priority order. */
export function Flags({ insight, compact = false }: { insight: Insight; compact?: boolean }) {
  const f: ReactNode[] = [];
  if (insight.replyOverdue) f.push(<span key="r" className="flag bad">No reply 24h+</span>);
  else if (insight.awaitingReply) f.push(<span key="a" className="flag warn">Awaiting reply</span>);
  if (insight.proposalOverdue) f.push(<span key="p" className="flag bad">Proposal overdue</span>);
  if (insight.followUpDue && !insight.replyOverdue)
    f.push(
      <span key="f" className="flag warn">
        {compact ? `${insight.daysSinceContact}d quiet` : `No contact ${insight.daysSinceContact} days`}
      </span>,
    );
  if (insight.overCapacity) f.push(<span key="c" className="flag warn" title="Over the Altar Room's 150. Second-room conversation">150+ guests</span>);
  return <>{f}</>;
}

// ---------- Modal ----------

export function Modal({
  title,
  onClose,
  children,
  labelledBy = 'modal-title',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button');
    first?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={ref}>
        <h2 id={labelledBy}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// ---------- Toast ----------

const ToastContext = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>();
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}
