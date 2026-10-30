// @ts-nocheck
import type { AppState, AppUser, AuditEntry, Doc, FDR, Lifecycle, Notice, ReleaseRequest, RenewalRequest, TimelineEvent, Verification } from "./types";
import { DEMO_TODAY, addDays, addMonths, fmtDate } from "./format";
import { detectFlags } from "./rules";

/* All institutions and banks below are fictional and illustrative. */
export const INSTITUTIONS = [
  "Northfield Institute of Technology",
  "Sarovar State University",
  "Keshav Medical College",
  "Deccan Polytechnic Board",
  "Riverbend Municipal Trust",
];
export const BANKS = ["Union Meridian Bank", "Bharat Crest Bank", "Coastal Federal Bank", "Pinnacle Co-operative Bank"];
const BRANCHES = ["Connaught Place, New Delhi", "MG Road, Bengaluru", "Park Street, Kolkata", "Nariman Point, Mumbai"];
export const OFFICERS = ["R. Iyer", "S. Banerjee", "A. Khan", "M. Pillai"];

export const USERS: AppUser[] = [
  { id: "u1", name: "Priya Nair", email: "priya.nair@northfield.demo", role: "operator", institution: INSTITUTIONS[0], active: true },
  { id: "u2", name: "Rahul Iyer", email: "r.iyer@finance.demo", role: "reviewer", institution: "Finance Department", active: true },
  { id: "u3", name: "Dr. Meera Kulkarni", email: "m.kulkarni@finance.demo", role: "approver", institution: "Finance Department", active: true },
  { id: "u4", name: "Sourav Banerjee", email: "s.banerjee@finance.demo", role: "reviewer", institution: "Finance Department", active: true },
  { id: "u5", name: "Ayesha Khan", email: "a.khan@finance.demo", role: "reviewer", institution: "Finance Department", active: true },
  { id: "u6", name: "Manoj Pillai", email: "m.pillai@finance.demo", role: "reviewer", institution: "Finance Department", active: true },
  { id: "u7", name: "Kavya Reddy", email: "k.reddy@sarovar.demo", role: "operator", institution: INSTITUTIONS[1], active: true },
  { id: "u8", name: "Imran Siddiqui", email: "i.siddiqui@keshav.demo", role: "operator", institution: INSTITUTIONS[2], active: false },
  { id: "u9", name: "Aditya", email: "aditya@finance.demo", role: "operator", institution: "Finance Department", active: true },
  { id: "u10", name: "Randhir", email: "randhir@finance.demo", role: "reviewer", institution: "Finance Department", active: true },
  { id: "u11", name: "Borshan", email: "borshan@finance.demo", role: "reviewer", institution: "Finance Department", active: true },
  { id: "u12", name: "Wajid", email: "wajid@finance.demo", role: "approver", institution: "Finance Department", active: true },
];

export const ROLE_USER: Record<string, string> = { operator: "Priya Nair", reviewer: "Rahul Iyer", approver: "Dr. Meera Kulkarni" };
export const ROLE_LABEL: Record<string, string> = { operator: "Institution Operator", reviewer: "Review Officer", approver: "Approving Authority" };

type Row = [string, number, number, number, number, number, number, Lifecycle, Verification, number | null, string, number?];
// fdrNumber, inst, bank, principal, rate, tenureMonths, maturityOffsetDays, lifecycle, verification, officerIdx, nextAction, actionDueOffset
const ROWS: Row[] = [
  ["UMB/2024/004512", 0, 0, 2500000, 7.1, 24, 1, "Active", "Issuer Verification Confirmed", 0, "Decide renewal or release before maturity", 0],
  ["BCB-77810342", 1, 1, 1800000, 6.85, 12, 3, "Renewal Due", "Issuer Verification Confirmed", 1, "Submit renewal instructions", 1],
  ["CFB/FD/220931", 2, 2, 5000000, 7.25, 36, 7, "Renewal Pending", "Issuer Verification Confirmed", 2, "Approve renewal request", 3],
  ["PCB-0099187", 3, 3, 750000, 6.5, 12, 5, "Active", "Issuer Verification Confirmed", null, "Assign officer and review maturity", -2],
  ["UMB/2025/008876", 4, 0, 1200000, 6.9, 12, 15, "Active", "Issuer Verification Confirmed", 3, "Confirm renewal intent with institution", 8],
  ["BCB-77810877", 0, 1, 3200000, 7.0, 24, 12, "Release Pending", "Issuer Verification Confirmed", 0, "Complete release review", 2],
  ["CFB/FD/221455", 1, 2, 950000, 6.75, 12, 30, "Active", "Issuer Verification Confirmed", 1, "Monitor maturity", 20],
  ["PCB-0099302", 2, 3, 4100000, 7.4, 36, 22, "Active", "Issuer Verification Pending", 2, "Obtain issuer confirmation", -5],
  ["UMB/2025/009120", 3, 0, 600000, 6.6, 6, -4, "Active", "Issuer Verification Confirmed", 3, "Matured — record renewal or release", -2],
  ["BCB-77811020", 4, 1, 2200000, 7.05, 24, -10, "Release Pending", "Issuer Verification Confirmed", 0, "Record release completion reference", -1],
  ["CFB/FD/221990", 0, 2, 1500000, 6.8, 12, 120, "Submitted", "Institution Submitted", 1, "Verify FDR document", 2],
  ["PCB-0099410", 1, 3, 850000, 6.95, 12, 200, "Under Scrutiny", "Documents Reviewed", 2, "Request missing FDR original", -3],
  ["BCB-77810342", 2, 1, 1750000, 6.85, 12, 250, "Submitted", "Institution Submitted", null, "Resolve duplicate FDR number", 1],
  ["UMB/2026/001044", 3, 0, 2750000, 7.15, 24, 400, "Under Scrutiny", "Issuer Verification Pending", 3, "Await issuer verification", 10],
  ["CFB/FD/222310", 4, 2, 1000000, 6.7, 12, 60, "Correction Requested", "Documents Reviewed", 0, "Institution to correct beneficiary name", 4],
  ["PCB-0098011", 0, 3, 2000000, 7.0, 12, -60, "Renewed", "Issuer Verification Confirmed", 1, "None — renewed", undefined],
  ["PCB-0099550", 0, 3, 2080000, 7.2, 12, 305, "Active", "Issuer Verification Confirmed", 1, "Monitor maturity", undefined],
  ["UMB/2024/003120", 1, 0, 1400000, 6.6, 24, -40, "Closed", "Issuer Verification Confirmed", 2, "None — closed", undefined],
  ["BCB-77809001", 2, 1, 650000, 6.4, 12, -25, "Released", "Issuer Verification Confirmed", 3, "Close instrument after release", 5],
  ["CFB/FD/219877", 3, 2, 3500000, 7.3, 36, 180, "Active", "Issuer Verification Confirmed", 1, "Monitor maturity", undefined],
  ["PCB-0099620", 4, 3, 1250000, 6.9, 12, 45, "Active", "Issuer Verification Confirmed", 2, "Monitor maturity", undefined],
  ["UMB/2025/007731", 0, 0, 4500000, 7.35, 36, 540, "Active", "Issuer Verification Confirmed", 3, "Monitor maturity", undefined],
  ["BCB-77811300", 1, 1, 900000, 6.8, 12, 75, "Active", "Issuer Verification Pending", null, "Assign officer for issuer verification", -7],
  ["CFB/FD/222588", 2, 2, 1600000, 7.0, 24, 95, "Active", "Issuer Verification Confirmed", 0, "Monitor maturity", undefined],
  ["PCB-0099701", 3, 3, 2300000, 7.1, 24, 150, "Active", "Issuer Verification Confirmed", 1, "Monitor maturity", undefined],
  ["UMB/2026/001310", 4, 0, 1100000, 11.5, 12, 365, "Under Scrutiny", "Documents Reviewed", 2, "Verify interest rate with bank advice", 3],
  ["BCB-77811455", 0, 1, 5500000, 7.4, 12, 28, "Renewal Due", "Issuer Verification Confirmed", 3, "Submit renewal instructions", 14],
  ["CFB/FD/221002", 1, 2, 800000, 6.6, 12, 9, "Active", "Issuer Verification Confirmed", 0, "Confirm renewal intent with institution", 4],
];

const ts = (iso: string, h = 10, m = 15) => `${iso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;

function buildTimeline(f: FDR, idx: number): TimelineEvent[] {
  const ev: TimelineEvent[] = [];
  let n = 0;
  const push = (day: string, title: string, from: Lifecycle | undefined, to: Lifecycle | undefined, actor: string, remarks: string, system = false, ref?: string) =>
    ev.push({ id: `${f.id}-e${n++}`, at: ts(day, 9 + (n % 8), (idx * 7) % 60), title, from, to, actor, remarks, system, ref });
  const inst = USERS.find((u) => u.institution === f.institution && u.role === "operator")?.name ?? "Institution Operator";
  const officer = f.officer ?? "Unassigned";
  const s = f.submittedAt.slice(0, 10);
  push(s, "FDR submitted", undefined, "Submitted", inst, `Submitted with ${f.documents.length} document(s).`, false, f.documents[0]?.name);
  if (f.lifecycle === "Submitted") return ev;
  push(addDays(s, 1), "Moved to scrutiny", "Submitted", "Under Scrutiny", "System", "Auto-assigned to verification queue.", true);
  if (f.lifecycle === "Under Scrutiny") return ev;
  if (f.lifecycle === "Correction Requested") {
    push(addDays(s, 2), "Correction requested", "Under Scrutiny", "Correction Requested", officer, "Beneficiary name on receipt does not match registered institution.");
    return ev;
  }
  push(addDays(s, 3), "Documents verified", "Under Scrutiny", "Verified", officer, "Registered values match document. Issuer confirmation requested.");
  push(addDays(s, 4), "Instrument activated", "Verified", "Active", "System", "Instrument entered active portfolio.", true);
  if (f.verification === "Issuer Verification Confirmed")
    push(addDays(s, 9), "Issuer verification confirmed", undefined, undefined, officer, "Confirmation letter received from issuing branch (demo record).", false, "BANK-CONF-" + (1000 + idx));
  const due = addDays(f.maturityDate, -30);
  if (["Renewal Due", "Renewal Pending", "Renewed"].includes(f.lifecycle) && due <= DEMO_TODAY)
    push(due, "Renewal window opened", "Active", "Renewal Due", "System", "30-day maturity reminder triggered.", true);
  if (f.lifecycle === "Renewal Pending" || f.lifecycle === "Renewed")
    push(addDays(f.maturityDate, -20), "Renewal requested", "Renewal Due", "Renewal Pending", inst, "Renewal for same tenure requested.");
  if (f.lifecycle === "Renewed") push(f.maturityDate, "Renewed into replacement FDR", "Renewal Pending", "Renewed", "Dr. Meera Kulkarni", "Renewal approved. Replacement linked.");
  if (["Release Pending", "Released", "Closed"].includes(f.lifecycle))
    push(addDays(f.maturityDate, -14), "Release requested", "Active", "Release Pending", inst, "Release requested on maturity.");
  if (f.lifecycle === "Released" || f.lifecycle === "Closed") push(addDays(f.maturityDate, 1), "Release completed", "Release Pending", "Released", officer, "Bank credit reference recorded.", false, "UTR" + (88120 + idx));
  if (f.lifecycle === "Closed") push(addDays(f.maturityDate, 3), "Instrument closed", "Released", "Closed", "Dr. Meera Kulkarni", "All conditions satisfied.");
  return ev;
}

export function buildSeed(): AppState {
  const fdrs: FDR[] = ROWS.map((r, i) => {
    const [num, ii, bi, principal, rate, tenure, off, lifecycle, verification, oi, nextAction, due] = r;
    const maturityDate = addDays(DEMO_TODAY, off);
    const issueDate = addMonths(maturityDate, -tenure);
    const submittedAt = ["Submitted", "Under Scrutiny", "Correction Requested"].includes(lifecycle)
      ? ts(addDays(DEMO_TODAY, -((i % 5) + 1)))
      : ts(addDays(issueDate, 3));
    const id = `fdr-${String(i + 1).padStart(3, "0")}`;
    const missingDoc = i === 11;
    const documents: Doc[] = missingDoc
      ? [{ id: id + "-d2", name: `Covering_Letter_${i + 1}.pdf`, kind: "Covering Letter", size: "182 KB", uploadedAt: submittedAt, uploadedBy: "Institution Operator" }]
      : [
          { id: id + "-d1", name: `FDR_${num.replace(/[^A-Z0-9]/gi, "_")}.pdf`, kind: "FDR Original", size: `${300 + ((i * 37) % 400)} KB`, uploadedAt: submittedAt, uploadedBy: "Institution Operator" },
          { id: id + "-d2", name: `Covering_Letter_${i + 1}.pdf`, kind: "Covering Letter", size: "182 KB", uploadedAt: submittedAt, uploadedBy: "Institution Operator" },
        ];
    return {
      id,
      ref: `ZF-26-${String(1001 + i)}`,
      fdrNumber: num,
      institution: INSTITUTIONS[ii],
      bank: BANKS[bi],
      branch: BRANCHES[bi],
      principal,
      rate,
      issueDate,
      maturityDate,
      tenureMonths: tenure,
      lifecycle,
      verification,
      officer: oi === null ? null : OFFICERS[oi],
      nextAction,
      actionDue: due === undefined ? undefined : addDays(DEMO_TODAY, due),
      documents,
      flags: [],
      submittedAt,
      timeline: [],
    };
  });

  // Scenario-specific extracted values
  fdrs[10].extracted = { principal: 1550000 };
  fdrs[14].extracted = { institution: "Riverbend Municipal Corporation" };
  fdrs[15].renewedToId = fdrs[16].id;
  fdrs[16].renewedFromId = fdrs[15].id;

  // Run rules on cases still in verification
  for (const f of fdrs) {
    if (["Submitted", "Under Scrutiny", "Correction Requested"].includes(f.lifecycle)) {
      f.flags = detectFlags({ ...f, hasDocument: f.documents.some((d) => d.kind === "FDR Original") }, fdrs);
    }
  }
  fdrs[14].flags.forEach((fl) => fl.type === "Institution name mismatch" && (fl.decision = "Requires institution clarification", fl.decidedBy = "R. Iyer", fl.decisionNote = "Asked institution to confirm legal beneficiary name."));
  fdrs.forEach((f, i) => (f.timeline = buildTimeline(f, i)));

  const rh = (day: string, actor: string, role: string, action: string, remarks: string) => ({ at: ts(day), actor, role, action, remarks });

  const releases: ReleaseRequest[] = [
    {
      id: "rel-1", ref: "REL-26-0041", fdrId: fdrs[5].id, kind: "Release", reason: "Project completion — security deposit no longer required.",
      stage: "Under Review", officer: "R. Iyer", docs: ["Release_Request_Letter.pdf", "Completion_Certificate.pdf"],
      conditions: [{ label: "Original FDR surrendered", met: true }, { label: "No pending dues certificate", met: false }, { label: "Maturity reached or premature release justified", met: false }],
      history: [rh(addDays(DEMO_TODAY, -3), "Priya Nair", "Institution Operator", "Submitted", "Release requested after project completion.")],
      createdAt: ts(addDays(DEMO_TODAY, -3)),
    },
    {
      id: "rel-2", ref: "REL-26-0038", fdrId: fdrs[9].id, kind: "Refund", reason: "Earnest money refund to bidder after tender finalisation.",
      stage: "Approved", officer: "R. Iyer", docs: ["Refund_Request.pdf", "Tender_Award_Note.pdf"],
      conditions: [{ label: "Original FDR surrendered", met: true }, { label: "No pending dues certificate", met: true }, { label: "Maturity reached or premature release justified", met: true }],
      history: [
        rh(addDays(DEMO_TODAY, -24), "Riverbend Operator", "Institution Operator", "Submitted", "Refund requested."),
        rh(addDays(DEMO_TODAY, -18), "R. Iyer", "Review Officer", "Recommended", "Eligibility and documents confirmed."),
        rh(addDays(DEMO_TODAY, -9), "Dr. Meera Kulkarni", "Approving Authority", "Approved", "Approved for refund on maturity."),
      ],
      createdAt: ts(addDays(DEMO_TODAY, -24)),
    },
    {
      id: "rel-3", ref: "REL-26-0029", fdrId: fdrs[17].id, kind: "Release", reason: "Matured; funds to be returned to institution account.",
      stage: "Closed", officer: "A. Khan", docs: ["Release_Request.pdf"],
      conditions: [{ label: "Original FDR surrendered", met: true }, { label: "No pending dues certificate", met: true }, { label: "Maturity reached or premature release justified", met: true }],
      history: [
        rh(addDays(fdrs[17].maturityDate, -14), "Kavya Reddy", "Institution Operator", "Submitted", "Release on maturity."),
        rh(addDays(fdrs[17].maturityDate, -10), "A. Khan", "Review Officer", "Recommended", "All conditions met."),
        rh(addDays(fdrs[17].maturityDate, -6), "Dr. Meera Kulkarni", "Approving Authority", "Approved", "Approved."),
        rh(addDays(fdrs[17].maturityDate, 1), "A. Khan", "Review Officer", "Completed", "Credit reference UTR88137."),
        rh(addDays(fdrs[17].maturityDate, 3), "Dr. Meera Kulkarni", "Approving Authority", "Closed", "Closure authorised."),
      ],
      completion: { ref: "UTR88137", date: addDays(fdrs[17].maturityDate, 1) },
      createdAt: ts(addDays(fdrs[17].maturityDate, -14)),
    },
    {
      id: "rel-4", ref: "REL-26-0033", fdrId: fdrs[18].id, kind: "Release", reason: "Matured; release to institution.",
      stage: "Completed", officer: "M. Pillai", docs: ["Release_Request.pdf"],
      conditions: [{ label: "Original FDR surrendered", met: true }, { label: "No pending dues certificate", met: true }, { label: "Maturity reached or premature release justified", met: true }],
      history: [
        rh(addDays(fdrs[18].maturityDate, -14), "Keshav Operator", "Institution Operator", "Submitted", "Release on maturity."),
        rh(addDays(fdrs[18].maturityDate, -8), "Dr. Meera Kulkarni", "Approving Authority", "Approved", "Approved."),
        rh(addDays(fdrs[18].maturityDate, 1), "M. Pillai", "Review Officer", "Completed", "Credit reference UTR88138."),
      ],
      completion: { ref: "UTR88138", date: addDays(fdrs[18].maturityDate, 1) },
      createdAt: ts(addDays(fdrs[18].maturityDate, -14)),
    },
  ];

  // Pending renewal for fdr-003: replacement registered as Submitted
  const repl: FDR = {
    ...fdrs[2],
    id: "fdr-029",
    ref: "ZF-26-1029",
    fdrNumber: "CFB/FD/223104",
    principal: 5000000,
    rate: 7.0,
    issueDate: fdrs[2].maturityDate,
    maturityDate: addMonths(fdrs[2].maturityDate, 36),
    lifecycle: "Submitted",
    verification: "Institution Submitted",
    nextAction: "Awaiting renewal approval",
    actionDue: addDays(DEMO_TODAY, 3),
    renewedFromId: fdrs[2].id,
    flags: [],
    documents: [{ id: "fdr-029-d1", name: "Renewal_Advice_CFB_223104.pdf", kind: "Renewal Advice", size: "240 KB", uploadedAt: ts(addDays(DEMO_TODAY, -2)), uploadedBy: "Institution Operator" }],
    submittedAt: ts(addDays(DEMO_TODAY, -2)),
    timeline: [],
  };
  repl.timeline = [{ id: "fdr-029-e0", at: repl.submittedAt, title: "Replacement FDR registered", to: "Submitted", actor: "Keshav Operator", remarks: `Linked as renewal of ${fdrs[2].ref}.`, system: false }];
  fdrs.push(repl);

  const renewals: RenewalRequest[] = [
    {
      id: "ren-1", ref: "REN-26-0017", oldId: fdrs[2].id, newId: repl.id, stage: "Recommended", remarks: "Renewal for 36 months at revised rate.",
      history: [
        rh(addDays(DEMO_TODAY, -2), "Keshav Operator", "Institution Operator", "Submitted", "Renewal advice attached."),
        rh(addDays(DEMO_TODAY, -1), "A. Khan", "Review Officer", "Recommended", "Rate reduction of 0.25% noted and acceptable."),
      ],
      createdAt: ts(addDays(DEMO_TODAY, -2)),
    },
    {
      id: "ren-0", ref: "REN-26-0009", oldId: fdrs[15].id, newId: fdrs[16].id, stage: "Approved", remarks: "Renewed with interest capitalised.",
      history: [
        rh(addDays(fdrs[15].maturityDate, -20), "Priya Nair", "Institution Operator", "Submitted", "Renewal with interest capitalisation."),
        rh(addDays(fdrs[15].maturityDate, -12), "S. Banerjee", "Review Officer", "Recommended", "Principal increase equals accrued interest."),
        rh(fdrs[15].maturityDate, "Dr. Meera Kulkarni", "Approving Authority", "Approved", "Approved."),
      ],
      createdAt: ts(addDays(fdrs[15].maturityDate, -20)),
    },
  ];

  const audit: AuditEntry[] = fdrs
    .flatMap((f) => f.timeline.filter((e) => !e.system).map((e) => ({ id: e.id + "-a", at: e.at, actor: e.actor, action: e.title, recordId: f.id, recordRef: f.ref, detail: e.remarks })))
    .sort((a, b) => b.at.localeCompare(a.at));

  const notices: Notice[] = [
    { id: "n1", at: ts(DEMO_TODAY, 8, 0), title: "Maturity tomorrow", body: `${fdrs[0].ref} (${fdrs[0].fdrNumber}) matures on ${fmtDate(fdrs[0].maturityDate)}.`, fdrId: fdrs[0].id, read: false },
    { id: "n2", at: ts(DEMO_TODAY, 7, 30), title: "Duplicate FDR number detected", body: `${fdrs[12].ref} shares its FDR number with ${fdrs[1].ref}.`, fdrId: fdrs[12].id, read: false },
    { id: "n3", at: ts(addDays(DEMO_TODAY, -1), 16, 10), title: "Renewal recommended", body: `REN-26-0017 for ${fdrs[2].ref} awaits approval.`, fdrId: fdrs[2].id, read: false },
    { id: "n4", at: ts(addDays(DEMO_TODAY, -1), 11, 0), title: "Overdue action", body: `${fdrs[3].ref} has no assigned officer and matures in 5 days.`, fdrId: fdrs[3].id, read: true },
  ];

  return { version: 1, role: "reviewer", fdrs, releases, renewals, audit, users: USERS, notices, reminderDays: [30, 15, 7, 1] };
}
