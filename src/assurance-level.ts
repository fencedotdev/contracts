import { z } from "zod";

// Shared across the passport (M·1), the verify() request's policy (M·3),
// and the verify() decision (M·4). No "basic" tier in the MSVP — retired,
// build-order decision #12 (fence-checklist-phase-0.md 0.6.2).
export const AssuranceLevelSchema = z.enum(["unverified", "full"]);

export type AssuranceLevel = z.infer<typeof AssuranceLevelSchema>;
