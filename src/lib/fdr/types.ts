// @ts-nocheck
export type Role = "operator" | "reviewer" | "approver";

export type Lifecycle =
  | "Submitted"
  | "Under Scrutiny"
  | "Correction Requested"
  | "Verified"
  | "Active"
  | "Renewal Due"
  | "Renewal Pending"
  | "Renewed"
  | "Release Pending"
  | "Released"
  | "Closed"
  | "Rejected";

export type Verification =
  | "Institution Submitted"
  | "Documents Reviewed"
  | "Issuer Verification Pending"
  | "Issuer Verification Confirmed";

export type FlagType =
  | "Duplicate FDR number"
  | "Missing mandatory field"
  | "Principal amount mismatch"
  | "Maturity date before issue date"
  | "Invalid interest rate"
  | "Institution name mismatch"
  | "Missing supporting document"
  | "Conflicting existing record";

export type FlagDecision =
  | "Open"
  | "Confirmed discrepancy"
  | "Resolved"
  | "Requires institution clarification"
  | "False positive";

export interface Flag {
  id: string;
  type: FlagType;
  severity: "High" | "Medium" | "Low";
  field: string;
  reason: string;
  expected: string;
  observed: string;
  suggestion: string;
  decision: FlagDecision;
  decisionNote?: string;
  decidedBy?: string;
}

export interface Doc {
  id: string;
  name: string;
  kind: "FDR Original" | "Covering Letter" | "Renewal Advice" | "Release Request" | "Bank Advice" | "Other";
  size: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  from?: Lifecycle;
  to?: Lifecycle;
  title: string;
  actor: string;
  remarks: string;
  ref?: string;
  system: boolean;
}

export interface FDR {
  id: string;
  ref: string;
  fdrNumber: string;
  institution: string;
  bank: string;
  branch: string;
  principal: number;
  rate: number;
  issueDate: string;
  maturityDate: string;
  tenureMonths: number;
  lifecycle: Lifecycle;
  verification: Verification;
  officer: string | null;
  nextAction: string;
  actionDue?: string;
  documents: Doc[];
  extracted?: { principal?: number; institution?: string; maturityDate?: string };
  flags: Flag[];
  renewedFromId?: string;
  renewedToId?: string;
  submittedAt: string;
  timeline: TimelineEvent[];
}

export type ReleaseStage = "Submitted" | "Under Review" | "Approved" | "Rejected" | "Completed" | "Closed";

export interface HistoryEntry {
  at: string;
  actor: string;
  role: string;
  action: string;
  remarks: string;
}

export interface ReleaseRequest {
  id: string;
  ref: string;
  fdrId: string;
  kind: "Release" | "Refund";
  reason: string;
  stage: ReleaseStage;
  officer: string | null;
  docs: string[];
  conditions: { label: string; met: boolean }[];
  history: HistoryEntry[];
  completion?: { ref: string; date: string };
  createdAt: string;
}

export type RenewalStage = "Under Review" | "Recommended" | "Approved" | "Rejected";

export interface RenewalRequest {
  id: string;
  ref: string;
  oldId: string;
  newId: string;
  stage: RenewalStage;
  remarks: string;
  history: HistoryEntry[];
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  recordId?: string;
  recordRef?: string;
  detail: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  institution: string;
  active: boolean;
}

export interface Notice {
  id: string;
  at: string;
  title: string;
  body: string;
  fdrId?: string;
  read: boolean;
}

export interface AppState {
  version: number;
  role: Role;
  fdrs: FDR[];
  releases: ReleaseRequest[];
  renewals: RenewalRequest[];
  audit: AuditEntry[];
  users: AppUser[];
  notices: Notice[];
  reminderDays: number[];
}
