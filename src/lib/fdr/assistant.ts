// @ts-nocheck
import type { AppState, FDR } from "./types";
import { DEMO_TODAY, daysToMaturity, fmtDate, fmtINR, fmtINRShort } from "./format";
import { isOpen, isOverdue, isPendingVerification, openFlags } from "./rules";

export interface Answer {
  text: string;
  method: string;
  records: FDR[];
  followUps: string[];
}

export const EXAMPLES = [
  "Which FDRs mature in the next 15 days?",
  "Which instruments have overdue actions?",
  "Show pending verification cases for Sarovar State University",
  "Which FDRs have unresolved discrepancies?",
  "What is the total principal value maturing this month?",
  "Show the renewal history of PCB-0099550",
];

const sum = (r: FDR[]) => r.reduce((s, f) => s + f.principal, 0);

/** Deterministic, rule-based answers computed from the demo dataset. No language model involved. */
export function ask(q: string, s: AppState): Answer {
  const t = q.toLowerCase();
  const inst = s.fdrs.map((f) => f.institution).find((n) => t.includes(n.toLowerCase()) || t.includes(n.split(" ")[0].toLowerCase()));
  const bank = s.fdrs.map((f) => f.bank).find((n) => t.includes(n.toLowerCase()));
  const scope = (r: FDR[]) => r.filter((f) => (!inst || f.institution === inst) && (!bank || f.bank === bank));
  const scopeText = [inst && `institution = ${inst}`, bank && `bank = ${bank}`].filter(Boolean).join(", ");

  const num = s.fdrs.find((f) => t.includes(f.fdrNumber.toLowerCase()) || t.includes(f.ref.toLowerCase()));
  if (t.includes("renewal") && (t.includes("history") || t.includes("chain")) && num) {
    const chain: FDR[] = [];
    let cur: FDR | undefined = num;
    while (cur?.renewedFromId) cur = s.fdrs.find((f) => f.id === cur!.renewedFromId);
    while (cur) {
      chain.push(cur);
      cur = cur.renewedToId ? s.fdrs.find((f) => f.id === cur!.renewedToId) : s.fdrs.find((f) => f.renewedFromId === cur!.id);
    }
    return {
      text: chain.length > 1 ? `The renewal chain has ${chain.length} instruments: ${chain.map((c) => `${c.fdrNumber} (${c.lifecycle})`).join(" → ")}.` : `${num.fdrNumber} has no linked renewals.`,
      method: "Followed renewedFrom / renewedTo links from the selected FDR in both directions.",
      records: chain,
      followUps: ["Which FDRs mature in the next 15 days?"],
    };
  }

  const m = t.match(/next (\d+) days?/);
  if (t.includes("matur") && (m || t.includes("this month"))) {
    if (m) {
      const n = Number(m[1]);
      const r = scope(s.fdrs.filter((f) => isOpen(f) && daysToMaturity(f.maturityDate) >= 0 && daysToMaturity(f.maturityDate) <= n)).sort((a, b) => a.maturityDate.localeCompare(b.maturityDate));
      return {
        text: r.length ? `${r.length} open FDR${r.length > 1 ? "s" : ""} mature within ${n} days, totalling ${fmtINR(sum(r))}. Earliest: ${r[0].fdrNumber} on ${fmtDate(r[0].maturityDate)}.` : `No open FDRs mature within ${n} days.`,
        method: `Open instruments with maturity date between ${fmtDate(DEMO_TODAY)} and +${n} days${scopeText ? `; ${scopeText}` : ""}.`,
        records: r,
        followUps: ["Which instruments have overdue actions?", "What is the total principal value maturing this month?"],
      };
    }
    const month = DEMO_TODAY.slice(0, 7);
    const r = scope(s.fdrs.filter((f) => f.maturityDate.startsWith(month)));
    return {
      text: `${r.length} FDRs mature in ${fmtDate(month + "-01").slice(3)} with total principal ${fmtINR(sum(r))} (${fmtINRShort(sum(r))}).`,
      method: `Sum of principal for all FDRs whose maturity date falls in ${month}${scopeText ? `; ${scopeText}` : ""}, any status.`,
      records: r,
      followUps: ["Which FDRs mature in the next 15 days?"],
    };
  }
  if (t.includes("overdue")) {
    const r = scope(s.fdrs.filter(isOverdue));
    return {
      text: r.length ? `${r.length} instruments have actions past their due date.` : "No overdue actions.",
      method: `Open FDRs whose action due date is before ${fmtDate(DEMO_TODAY)}${scopeText ? `; ${scopeText}` : ""}.`,
      records: r,
      followUps: ["Which FDRs have unresolved discrepancies?"],
    };
  }
  if (t.includes("discrepanc") || t.includes("flag") || t.includes("anomal")) {
    const r = scope(s.fdrs.filter((f) => openFlags(f).length > 0));
    return {
      text: r.length ? `${r.length} FDRs carry ${r.reduce((a, f) => a + openFlags(f).length, 0)} unresolved rule flags. Flags indicate administrative inconsistencies, not verified findings.` : "No unresolved discrepancies.",
      method: `FDRs with flags in Open or Requires-clarification state${scopeText ? `; ${scopeText}` : ""}.`,
      records: r,
      followUps: ["Which instruments have overdue actions?"],
    };
  }
  if (t.includes("verif") || t.includes("pending")) {
    const r = scope(s.fdrs.filter(isPendingVerification));
    return {
      text: r.length ? `${r.length} cases are pending verification${inst ? ` for ${inst}` : ""}.` : `No pending verification cases${inst ? ` for ${inst}` : ""}.`,
      method: `Lifecycle in Submitted, Under Scrutiny or Correction Requested${scopeText ? `; ${scopeText}` : ""}.`,
      records: r,
      followUps: ["Which FDRs have unresolved discrepancies?"],
    };
  }
  return {
    text: "I can answer questions about maturities, overdue actions, pending verification, discrepancies, monthly maturity totals, and renewal history. Try one of the suggestions below.",
    method: "No supported query pattern matched.",
    records: [],
    followUps: EXAMPLES.slice(0, 3),
  };
}
