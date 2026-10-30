// @ts-nocheck
import { useCallback, useRef, useSyncExternalStore } from "react";
import type { AppState, AppUser, Doc, FDR, FlagDecision, Lifecycle, ReleaseRequest, Role, TimelineEvent, Verification } from "./types";
import { buildSeed, ROLE_LABEL, ROLE_USER } from "./seed";
import { DEMO_TODAY, addDays, uid } from "./format";
import { detectFlags, type Candidate } from "./rules";

const KEY = "zenithfdr-demo-v1";
const seed = buildSeed();
let state: AppState = seed;
const listeners = new Set<() => void>();

function emit() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable */
    }
  }
  listeners.forEach((l) => l());
}

function set(fn: (s: AppState) => AppState) {
  state = fn(state);
  emit();
}

export function hydrateStore() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === seed.version) {
        // Merge in seed users added after this state was saved (by id).
        const have = new Set(parsed.users.map((u) => u.id));
        parsed.users = [...parsed.users, ...seed.users.filter((u) => !have.has(u.id))];
        state = parsed;
        listeners.forEach((l) => l());
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
}

export function getState() {
  return state;
}

export function useStore<T>(sel: (s: AppState) => T): T {
  // Selectors may return freshly-built objects (e.g. `{ ver: ... }`), so the
  // snapshot must be cached per source state or React loops forever.
  const selRef = useRef(sel);
  selRef.current = sel;
  const cacheRef = useRef<{ s: AppState; v: T } | null>(null);
  const getSnapshot = useCallback(() => {
    if (!cacheRef.current || cacheRef.current.s !== state) cacheRef.current = { s: state, v: selRef.current(state) };
    return cacheRef.current.v;
  }, []);
  const getServerSnapshot = useCallback(() => {
    if (!cacheRef.current || cacheRef.current.s !== seed) cacheRef.current = { s: seed, v: selRef.current(seed) };
    return cacheRef.current.v;
  }, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSnapshot,
    getServerSnapshot,
  );
}

export const actor = () => ROLE_USER[state.role];
const actorRole = () => ROLE_LABEL[state.role];
const now = () => new Date().toISOString();

function withEvent(s: AppState, fdrId: string, ev: Omit<TimelineEvent, "id" | "at" | "actor"> & { actor?: string }, patch: Partial<FDR> = {}): AppState {
  const at = now();
  const who = ev.actor ?? actor();
  let ref = "";
  const fdrs = s.fdrs.map((f) => {
    if (f.id !== fdrId) return f;
    ref = f.ref;
    const from = ev.to ? f.lifecycle : undefined;
    return { ...f, ...patch, timeline: [...f.timeline, { ...ev, from: ev.from ?? from, id: uid("ev"), at, actor: who }] };
  });
  return { ...s, fdrs, audit: [{ id: uid("au"), at, actor: who, action: ev.title, recordId: fdrId, recordRef: ref, detail: ev.remarks }, ...s.audit] };
}

function nextRef(s: AppState) {
  const max = Math.max(...s.fdrs.map((f) => Number(f.ref.split("-").pop())));
  return `ZF-26-${max + 1}`;
}

export const actions = {
  setRole(role: Role) {
    set((s) => ({ ...s, role }));
  },
  reset() {
    state = buildSeed();
    emit();
  },
  markRead(id?: string) {
    set((s) => ({ ...s, notices: s.notices.map((n) => (!id || n.id === id ? { ...n, read: true } : n)) }));
  },
  setReminderDays(days: number[]) {
    set((s) => ({ ...s, reminderDays: days }));
  },

  registerFDR(c: Omit<Candidate, "hasDocument" | "id"> & { branch: string; tenureMonths: number; officer: string | null }, docs: Omit<Doc, "id" | "uploadedAt" | "uploadedBy">[], source: string, lifecycle: Lifecycle = "Submitted") {
    let created!: FDR;
    set((s) => {
      const id = uid("fdr");
      const at = now();
      const documents: Doc[] = docs.map((d) => ({ ...d, id: uid("doc"), uploadedAt: at, uploadedBy: actor() }));
      const flags = detectFlags({ ...c, hasDocument: documents.some((d) => d.kind === "FDR Original") }, s.fdrs);
      created = {
        id,
        ref: nextRef(s),
        fdrNumber: c.fdrNumber,
        institution: c.institution,
        bank: c.bank,
        branch: c.branch,
        principal: c.principal,
        rate: c.rate,
        issueDate: c.issueDate,
        maturityDate: c.maturityDate,
        tenureMonths: c.tenureMonths,
        lifecycle,
        verification: "Institution Submitted",
        officer: c.officer,
        nextAction: flags.length ? "Review flagged discrepancies" : "Verify FDR document",
        actionDue: addDays(DEMO_TODAY, 3),
        documents,
        extracted: c.extracted,
        flags,
        submittedAt: at,
        timeline: [{ id: uid("ev"), at, to: lifecycle, title: "FDR submitted", actor: actor(), remarks: `Registered via ${source}. ${flags.length} rule flag(s) raised.`, system: false, ref: documents[0]?.name }],
      };
      return {
        ...s,
        fdrs: [created, ...s.fdrs],
        audit: [{ id: uid("au"), at, actor: actor(), action: "FDR created", recordId: id, recordRef: created.ref, detail: `${c.fdrNumber} via ${source}` }, ...s.audit],
        notices: [{ id: uid("n"), at, title: "New FDR submitted", body: `${created.ref} entered the verification queue.`, fdrId: id, read: false }, ...s.notices],
      };
    });
    return created;
  },

  editFDR(id: string, patch: Partial<Pick<FDR, "principal" | "rate" | "maturityDate" | "issueDate" | "branch" | "institution" | "bank">>, remarks: string) {
    set((s) => withEvent(s, id, { title: "Record modified", remarks: remarks || `Updated: ${Object.keys(patch).join(", ")}`, system: false }, patch));
  },

  deleteFDR(id: string) {
    set((s) => {
      const f = s.fdrs.find((x) => x.id === id);
      return { ...s, fdrs: s.fdrs.filter((x) => x.id !== id), audit: [{ id: uid("au"), at: now(), actor: actor(), action: "Draft submission withdrawn", recordId: id, recordRef: f?.ref, detail: f?.fdrNumber ?? "" }, ...s.audit] };
    });
  },

  assignOfficer(ids: string[], officer: string) {
    set((s) => ids.reduce((acc, id) => withEvent(acc, id, { title: "Officer assigned", remarks: `Assigned to ${officer}.`, system: false }, { officer }), s));
  },

  addDocument(id: string, name: string, kind: Doc["kind"], size: string) {
    set((s) => {
      const f = s.fdrs.find((x) => x.id === id)!;
      const documents = [...f.documents, { id: uid("doc"), name, kind, size, uploadedAt: now(), uploadedBy: actor() }];
      const flags = f.flags.map((fl) => (fl.type === "Missing supporting document" && kind === "FDR Original" && fl.decision === "Open" ? { ...fl, decision: "Resolved" as FlagDecision, decidedBy: "System", decisionNote: `Resolved by upload of ${name}.` } : fl));
      return withEvent(s, id, { title: "Document uploaded", remarks: `${kind}: ${name}`, system: false, ref: name }, { documents, flags });
    });
  },

  decideFlag(fdrId: string, flagId: string, decision: FlagDecision, note: string) {
    set((s) => {
      const f = s.fdrs.find((x) => x.id === fdrId)!;
      const fl = f.flags.find((x) => x.id === flagId)!;
      const flags = f.flags.map((x) => (x.id === flagId ? { ...x, decision, decisionNote: note, decidedBy: actor() } : x));
      return withEvent(s, fdrId, { title: `Discrepancy marked: ${decision}`, remarks: `${fl.type} — ${note || "No remarks"}`, system: false }, { flags });
    });
  },

  setVerification(fdrId: string, v: Verification, remarks: string) {
    set((s) => withEvent(s, fdrId, { title: `Verification: ${v}`, remarks, system: false }, { verification: v }));
  },

  transition(fdrId: string, to: Lifecycle, title: string, remarks: string, patch: Partial<FDR> = {}) {
    set((s) => withEvent(s, fdrId, { title, to, remarks, system: false }, { ...patch, lifecycle: to }));
  },

  createRenewal(oldId: string, data: { fdrNumber: string; principal: number; rate: number; bank: string; issueDate: string; maturityDate: string; tenureMonths: number }, remarks: string) {
    const s0 = state;
    if (s0.renewals.some((r) => r.oldId === oldId && ["Under Review", "Recommended", "Approved"].includes(r.stage))) {
      throw new Error("An active renewal chain already exists for this FDR.");
    }
    const old = s0.fdrs.find((f) => f.id === oldId)!;
    const created = actions.registerFDR(
      { ...data, institution: old.institution, branch: old.branch, officer: old.officer },
      [{ name: `Renewal_Advice_${data.fdrNumber.replace(/[^A-Z0-9]/gi, "_")}.pdf`, kind: "FDR Original", size: "220 KB" }],
      `renewal of ${old.ref}`,
    );
    const renRef = `REN-26-${String(20 + s0.renewals.length).padStart(4, "0")}`;
    set((s) => {
      let n = { ...s, fdrs: s.fdrs.map((f) => (f.id === created.id ? { ...f, renewedFromId: oldId, nextAction: "Awaiting renewal approval" } : f)) };
      n = withEvent(n, oldId, { title: "Renewal requested", to: "Renewal Pending", remarks: `${renRef}: replacement ${created.ref} registered. ${remarks}`, system: false }, { lifecycle: "Renewal Pending", nextAction: "Approve renewal request" });
      return { ...n, renewals: [{ id: uid("ren"), ref: renRef, oldId, newId: created.id, stage: "Under Review", remarks, createdAt: now(), history: [{ at: now(), actor: actor(), role: actorRole(), action: "Submitted", remarks }] }, ...n.renewals] };
    });
    return created;
  },

  renewalAction(id: string, action: "Recommended" | "Approved" | "Rejected", remarks: string) {
    set((s) => {
      const r = s.renewals.find((x) => x.id === id)!;
      let n: AppState = { ...s, renewals: s.renewals.map((x) => (x.id === id ? { ...x, stage: action, history: [...x.history, { at: now(), actor: actor(), role: actorRole(), action, remarks }] } : x)) };
      if (action === "Approved") {
        n = withEvent(n, r.oldId, { title: "Renewed into replacement FDR", to: "Renewed", remarks: `${r.ref} approved. ${remarks}`, system: false }, { lifecycle: "Renewed", renewedToId: r.newId, nextAction: "None — renewed", actionDue: undefined });
        n = withEvent(n, r.newId, { title: "Renewal approved — instrument active", to: "Active", remarks: `Linked replacement of previous FDR. ${remarks}`, system: false }, { lifecycle: "Active", verification: "Issuer Verification Pending", nextAction: "Obtain issuer confirmation", actionDue: addDays(DEMO_TODAY, 10) });
      } else if (action === "Rejected") {
        n = withEvent(n, r.oldId, { title: "Renewal rejected", to: "Renewal Due", remarks, system: false }, { lifecycle: "Renewal Due", nextAction: "Submit revised renewal or release request" });
        n = withEvent(n, r.newId, { title: "Replacement rejected", to: "Rejected", remarks, system: false }, { lifecycle: "Rejected", nextAction: "None — rejected", actionDue: undefined });
      } else {
        n = withEvent(n, r.oldId, { title: "Renewal recommended", remarks, system: false });
      }
      return n;
    });
  },

  createRelease(fdrId: string, kind: "Release" | "Refund", reason: string, docs: string[]) {
    const s0 = state;
    if (s0.releases.some((r) => r.fdrId === fdrId && ["Submitted", "Under Review", "Approved", "Completed"].includes(r.stage))) {
      throw new Error("A release or refund request is already in progress for this FDR.");
    }
    const ref = `REL-26-${String(42 + s0.releases.length).padStart(4, "0")}`;
    const req: ReleaseRequest = {
      id: uid("rel"), ref, fdrId, kind, reason, stage: "Submitted", officer: s0.fdrs.find((f) => f.id === fdrId)?.officer ?? null, docs,
      conditions: [{ label: "Original FDR surrendered", met: false }, { label: "No pending dues certificate", met: false }, { label: "Maturity reached or premature release justified", met: false }],
      history: [{ at: now(), actor: actor(), role: actorRole(), action: "Submitted", remarks: reason }],
      createdAt: now(),
    };
    set((s) => withEvent({ ...s, releases: [req, ...s.releases] }, fdrId, { title: `${kind} requested`, to: "Release Pending", remarks: `${ref}: ${reason}`, system: false }, { lifecycle: "Release Pending", nextAction: "Complete release review", actionDue: addDays(DEMO_TODAY, 5) }));
    return req;
  },

  toggleCondition(id: string, idx: number) {
    set((s) => ({ ...s, releases: s.releases.map((r) => (r.id === id ? { ...r, conditions: r.conditions.map((c, i) => (i === idx ? { ...c, met: !c.met } : c)) } : r)) }));
  },

  releaseAction(id: string, action: "Under Review" | "Approved" | "Rejected" | "Completed" | "Closed", remarks: string, completion?: { ref: string; date: string }) {
    set((s) => {
      const r = s.releases.find((x) => x.id === id)!;
      const label = action === "Under Review" ? "Recommended" : action;
      let n: AppState = { ...s, releases: s.releases.map((x) => (x.id === id ? { ...x, stage: action, completion: completion ?? x.completion, history: [...x.history, { at: now(), actor: actor(), role: actorRole(), action: label, remarks }] } : x)) };
      if (action === "Approved") n = withEvent(n, r.fdrId, { title: `${r.kind} approved (not yet disbursed)`, remarks: `${r.ref}: ${remarks}`, system: false }, { nextAction: "Record release completion reference" });
      if (action === "Rejected") n = withEvent(n, r.fdrId, { title: `${r.kind} rejected`, to: "Active", remarks: `${r.ref}: ${remarks}`, system: false }, { lifecycle: "Active", nextAction: "Monitor maturity" });
      if (action === "Completed") n = withEvent(n, r.fdrId, { title: `${r.kind} completed`, to: "Released", remarks: `${r.ref}: reference ${completion?.ref}. ${remarks}`, system: false, ref: completion?.ref }, { lifecycle: "Released", nextAction: "Close instrument after release" });
      if (action === "Closed") n = withEvent(n, r.fdrId, { title: "Instrument closed", to: "Closed", remarks: `${r.ref}: ${remarks}`, system: false }, { lifecycle: "Closed", nextAction: "None — closed", actionDue: undefined });
      if (action === "Under Review") n = withEvent(n, r.fdrId, { title: `${r.kind} recommended by reviewer`, remarks: `${r.ref}: ${remarks}`, system: false });
      return n;
    });
  },

  logDossier(fdrId: string) {
    set((s) => withEvent(s, fdrId, { title: "Audit dossier generated", remarks: "PDF dossier downloaded.", system: false }));
  },

  upsertUser(u: AppUser) {
    set((s) => {
      const exists = s.users.some((x) => x.id === u.id);
      return { ...s, users: exists ? s.users.map((x) => (x.id === u.id ? u : x)) : [...s.users, u], audit: [{ id: uid("au"), at: now(), actor: actor(), action: exists ? "User updated" : "User added", detail: `${u.name} (${ROLE_LABEL[u.role]})` }, ...s.audit] };
    });
  },

  toggleUser(id: string) {
    set((s) => {
      const u = s.users.find((x) => x.id === id)!;
      return { ...s, users: s.users.map((x) => (x.id === id ? { ...x, active: !x.active } : x)), audit: [{ id: uid("au"), at: now(), actor: actor(), action: u.active ? "User deactivated" : "User activated", detail: u.name }, ...s.audit] };
    });
  },
};
