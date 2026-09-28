import { differenceInCalendarDays, format, formatDistanceToNowStrict } from 'date-fns';

const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

export function formatMoney(v: number | null | undefined): string {
  return v == null ? '—' : money.format(v);
}

/** $267k style, for headline numbers. */
export function formatMoneyShort(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (v >= 10_000) return `$${Math.round(v / 1000)}k`;
  return money.format(v);
}

export function formatPercent(v: number | null | undefined): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`;
}

export function formatDate(iso: string | number | null | undefined, pattern = 'EEE d MMM yyyy'): string {
  if (iso == null || iso === '') return '—';
  const d = typeof iso === 'string' && iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
  return format(d, pattern);
}

export function formatDateTime(iso: string | number): string {
  return format(new Date(iso), 'EEE d MMM, h:mmaaa');
}

export function formatTime(iso: string | number): string {
  return format(new Date(iso), 'h:mmaaa');
}

export function timeAgo(iso: string | number): string {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
}

export function daysUntil(dateOnly: string | null): number | null {
  if (!dateOnly) return null;
  return differenceInCalendarDays(new Date(dateOnly + 'T12:00:00'), new Date());
}

export function formatHours(h: number | null): string {
  if (h == null) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1).replace(/\.0$/, '')} hrs`;
  return `${(h / 24).toFixed(1).replace(/\.0$/, '')} days`;
}

export function formatDays(d: number | null): string {
  if (d == null) return '—';
  return `${d.toFixed(1).replace(/\.0$/, '')} days`;
}

export function fullName(c: { firstName: string; lastName: string }): string {
  return `${c.firstName} ${c.lastName}`.trim();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** Value for a <input type="datetime-local">, in local time. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
