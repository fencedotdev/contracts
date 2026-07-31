import { z } from "zod";

// Shared across the passport (M·1) and the verify() decision (M·4) —
// verifiers reject a non-live passport in production (App. K).
export const EnvironmentSchema = z.enum(["live", "test"]);

export type Environment = z.infer<typeof EnvironmentSchema>;
