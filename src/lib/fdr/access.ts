// @ts-nocheck
import type { Role } from "./types";
import { ROLE_LABEL } from "./seed";

/** Simulated role hierarchy for the demo: operator < reviewer < approver. */
const RANK: Record<Role, number> = { operator: 1, reviewer: 2, approver: 3 };

export const can = (role: Role, min: Role) => RANK[role] >= RANK[min];
export const minLabel = (min: Role) => ROLE_LABEL[min];
