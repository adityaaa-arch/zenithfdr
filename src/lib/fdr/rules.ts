// @ts-nocheck
import type { FDR, Flag, Lifecycle, ReleaseRequest, RenewalRequest, Verification } from "./types";
import { DEMO_TODAY, daysToMaturity, fmtDate, fmtINR, uid } from "./format";

export type Tone = "neutral" | "info" | "success" | "warning" | "critical" | "teal";

export const LIFECYCLE_TONE: Record<Lifecycle, Tone> = {
  Submitted: "info",
  "Under Scrutiny": "info",
  "Correction Requested": "warning",
  Verified: "teal",
  Active: "success",
  "Renewal Due": "warning",
  "Renewal Pending": "warning",
  Renewed: "neutral",
  "Release Pending": "warning",
  Released: "neutral",
  Closed: "neutral",
  Rejected: "critical",
};

export const VERIFICATION_TONE: Record<Verification, Tone> = {
  "Institution Submitted": "info",
  "Documents Reviewed": "teal",
  "Issuer Verification Pending": "warning",
  "Issuer Verification Confirmed": "success",
};

export const LIFECYCLES: Lifecycle[] = Object.keys(LIFECYCLE_TONE) as Lifecycle[];
export const VERIFICATIONS: Verification[] = Object.keys(VERIFICATION_TONE) as Verification[];

export const CLOSED_STATES: Lifecycle[] = ["Renewed", "Released", "Closed", "Rejected"];
export const isOpen = (f: FDR) => !CLOSED_STATES.includes(f.lifecycle);
export const isPendingVerification = (f: FDR) =>
  ["Submitted", "Under Scrutiny", "Correction Requested"].includes(f.lifecycle);
export const openFlags = (f: FDR) => f.flags.filter((x) => x.decision === "Open" || x.decision === "Requires institution clarification");
export const isOverdue = (f: FDR) => isOpen(f) && !!f.actionDue && f.actionDue < DEMO_TODAY;

export type MaturityWindow = "1-7" | "8-15" | "16-30" | "31-90" | "90+" | "matured";
export function maturityWindow(f: FDR): MaturityWindow {
  const d = daysToMaturity(f.maturityDate);
  if (d < 0) return "matured";
  if (d <= 7) return "1-7";
  if (d <= 15) return "8-15";
  if (d <= 30) return "16-30";
  if (d <= 90) return "31-90";
  return "90+";
}
export const WINDOW_LABEL: Record<MaturityWindow, string> = {
  "1-7": "1–7 days",
  "8-15": "8–15 days",
  "16-30": "16–30 days",
  "31-90": "31–90 days",
  "90+": "Beyond 90 days",
  matured: "Matured",
};

/* ------------------------ Anomaly detection ------------------------ */

export interface Candidate {
  id?: string;
  fdrNumber: string;
  institution: string;
  bank: string;
  principal: number;
  rate: number;
  issueDate: string;
  maturityDate: string;
  hasDocument: boolean;
  extracted?: { principal?: number; institution?: string; maturityDate?: string };
}

const MANDATORY: (keyof Candidate)[] = ["fdrNumber", "institution", "bank", "principal", "rate", "issueDate", "maturityDate"];

/** Transparent rule-based checks. A flag is an administrative inconsistency, never proof of fraud. */
export function detectFlags(c: Candidate, all: FDR[]): Flag[] {
  const flags: Flag[] = [];
  const add = (f: Omit<Flag, "id" | "decision">) => flags.push({ ...f, id: uid("flg"), decision: "Open" });

  for (const k of MANDATORY) {
    const v = c[k];
    if (v === "" || v === undefined || v === null || (typeof v === "number" && (!v || Number.isNaN(v)))) {
      add({ type: "Missing mandatory field", severity: "High", field: String(k), reason: `Mandatory field "${k}" is empty.`, expected: "A value", observed: "Empty", suggestion: "Enter the value from the original instrument or request it from the institution." });
    }
  }
  const others = all.filter((f) => f.id !== c.id);
  const dup = others.find((f) => f.fdrNumber.trim().toUpperCase() === c.fdrNumber.trim().toUpperCase() && c.fdrNumber);
  if (dup) {
    add({ type: "Duplicate FDR number", severity: "High", field: "fdrNumber", reason: `FDR number already registered as ${dup.ref} (${dup.institution}, ${dup.bank}).`, expected: "Unique FDR number", observed: c.fdrNumber, suggestion: "Confirm whether this is the same instrument re-submitted or a data-entry error." });
    if (dup.principal !== c.principal || dup.maturityDate !== c.maturityDate) {
      add({ type: "Conflicting existing record", severity: "Medium", field: "fdrNumber", reason: `Existing record ${dup.ref} has different details for the same number.`, expected: `${fmtINR(dup.principal)}, matures ${fmtDate(dup.maturityDate)}`, observed: `${fmtINR(c.principal)}, matures ${fmtDate(c.maturityDate)}`, suggestion: "Compare both instruments against originals before proceeding." });
    }
  }
  if (c.issueDate && c.maturityDate && c.maturityDate <= c.issueDate) {
    add({ type: "Maturity date before issue date", severity: "High", field: "maturityDate", reason: "Maturity date is on or before the issue date.", expected: `After ${fmtDate(c.issueDate)}`, observed: fmtDate(c.maturityDate), suggestion: "Re-check both dates against the instrument." });
  }
  if (c.rate && (c.rate < 2.5 || c.rate > 9.5)) {
    add({ type: "Invalid interest rate", severity: "Medium", field: "rate", reason: "Interest rate is outside the configured plausible band (2.50%–9.50%).", expected: "2.50% – 9.50%", observed: `${c.rate.toFixed(2)}%`, suggestion: "Verify the rate printed on the receipt or the bank's rate advice." });
  }
  if (c.extracted?.principal !== undefined && c.extracted.principal !== c.principal) {
    add({ type: "Principal amount mismatch", severity: "High", field: "principal", reason: "Principal on the document differs from the registered amount.", expected: fmtINR(c.extracted.principal) + " (document)", observed: fmtINR(c.principal) + " (registered)", suggestion: "Correct the registered amount or request clarification from the institution." });
  }
  if (c.extracted?.maturityDate && c.extracted.maturityDate !== c.maturityDate) {
    add({ type: "Conflicting existing record", severity: "Medium", field: "maturityDate", reason: "Maturity date on document differs from registered date.", expected: fmtDate(c.extracted.maturityDate) + " (document)", observed: fmtDate(c.maturityDate) + " (registered)", suggestion: "Align the registered date with the instrument." });
  }
  if (c.extracted?.institution && c.extracted.institution.trim().toLowerCase() !== c.institution.trim().toLowerCase()) {
    add({ type: "Institution name mismatch", severity: "Medium", field: "institution", reason: "Beneficiary on document does not match the registered institution.", expected: c.institution, observed: c.extracted.institution, suggestion: "Confirm the beneficiary name with the institution." });
  }
  if (!c.hasDocument) {
    add({ type: "Missing supporting document", severity: "Medium", field: "documents", reason: "No FDR original or scanned copy is attached.", expected: "FDR Original attached", observed: "None", suggestion: "Request the institution to upload the scanned instrument." });
  }
  return flags;
}

/* ------------------------ Priority score ------------------------ */

export interface ScoreFactor {
  label: string;
  points: number;
}

/** Illustrative operational prioritisation aid (0–100). Not a credit rating, fraud probability or risk prediction. */
export function priorityScore(f: FDR, releases: ReleaseRequest[], renewals: RenewalRequest[]) {
  const factors: ScoreFactor[] = [];
  if (!isOpen(f)) return { score: 0, factors, recommendation: "No action — instrument is closed." };
  const d = daysToMaturity(f.maturityDate);
  if (d < 0) factors.push({ label: `Matured ${-d} days ago, not closed`, points: 35 });
  else if (d <= 7) factors.push({ label: `Matures in ${d} days`, points: 30 });
  else if (d <= 15) factors.push({ label: `Matures in ${d} days`, points: 20 });
  else if (d <= 30) factors.push({ label: `Matures in ${d} days`, points: 10 });
  if (isOverdue(f)) factors.push({ label: "Action past its due date", points: 20 });
  if (!f.documents.some((x) => x.kind === "FDR Original")) factors.push({ label: "FDR original not on file", points: 15 });
  if (isPendingVerification(f)) factors.push({ label: "Verification pending", points: 10 });
  if (!f.officer) factors.push({ label: "No officer assigned", points: 10 });
  const pendingApproval =
    releases.some((r) => r.fdrId === f.id && ["Submitted", "Under Review", "Approved"].includes(r.stage)) ||
    renewals.some((r) => r.oldId === f.id && ["Under Review", "Recommended"].includes(r.stage));
  if (pendingApproval) factors.push({ label: "Approval dependency outstanding", points: 10 });
  const of = openFlags(f).length;
  if (of) factors.push({ label: `${of} unresolved flag${of > 1 ? "s" : ""}`, points: Math.min(10, of * 5) });
  const score = Math.min(100, factors.reduce((s, x) => s + x.points, 0));
  return { score, factors, recommendation: f.nextAction };
}

export function scoreTone(s: number): Tone {
  if (s >= 60) return "critical";
  if (s >= 35) return "warning";
  if (s > 0) return "info";
  return "neutral";
}
