// @ts-nocheck
/** Fixed demo reference date keeps maturity categories coherent during judging. */
export const DEMO_TODAY = "2026-10-30";

const DAY = 86400000;

export function parseDate(d: string) {
  return new Date(d.length === 10 ? d + "T00:00:00Z" : d);
}

export function addDays(iso: string, days: number) {
  const d = parseDate(iso);
  return new Date(d.getTime() + days * DAY).toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number) {
  const d = parseDate(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / DAY);
}

export function daysToMaturity(maturity: string) {
  return daysBetween(DEMO_TODAY, maturity);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = parseDate(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const t = d.toISOString().slice(11, 16);
  return `${fmtDate(d.toISOString().slice(0, 10))}, ${t} UTC`;
}

export function monthLabel(iso: string) {
  const d = parseDate(iso);
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function fmtINR(n: number) {
  return inr.format(n);
}

/** Compact Indian notation: lakh / crore */
export function fmtINRShort(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return fmtINR(n);
}

export function relDays(d: number) {
  if (d === 0) return "Today";
  if (d > 0) return `${d}d left`;
  return `${-d}d overdue`;
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
