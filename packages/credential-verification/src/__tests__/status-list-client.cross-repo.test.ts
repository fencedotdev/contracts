import { describe, expect, it } from "vitest";
import { checkOfflineRevocationStatus } from "../status-list-client";

// Ported from verification/src/__tests__/status-list-client.cross-repo.test.ts
// (2026-08-21) — "the one test that actually proves the two
// independently-deployed services agree on what's signed, not just that
// each repo's own unit tests pass in isolation." Hits scope-policy's
// real, deployed, unauthenticated `/api/status/live` route to fetch a
// credential genuinely signed moments ago by scope-policy's real KMS
// signer — not a synthetic fixture — and verifies it against the real
// `#status-key` published at fence.dev's live did:web document. No
// injected/stubbed leg anywhere: every fetch this makes, including the
// did:web resolution itself, goes over the real network to the real
// deployed services.
//
// Network-dependent by nature (hits two live hosts within
// status-list-client.ts's own 500ms-per-fetch budget) — verification's
// own copy of this test saw occasional transient failures under a
// cold/loaded environment, fixed there with a retry rather than loosening
// the timeout budget (a deliberate real latency guarantee, not test
// convenience). Ported here with the same retry. Retrying only on
// "unavailable" still fails loud (after using the test's own generous
// 10s budget) if the two services genuinely disagree on what's signed —
// a real signature_invalid wouldn't be fixed by retrying and this would
// still catch it.
const STATUS_LIST_URL = "https://api-scope.fence.dev/api/status/live";
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 300;

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("checkOfflineRevocationStatus() — real cross-repo signing round trip", () => {
  it(
    "verifies a credential genuinely signed moments ago by scope-policy's real KMS signer, against the real #status-key published at fence.dev's live did:web document",
    async () => {
      let result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "0", "live");
      for (let attempt = 1; attempt < RETRY_ATTEMPTS && result.status === "unavailable"; attempt++) {
        await delay(RETRY_DELAY_MS);
        result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "0", "live");
      }

      expect(["revoked", "not_revoked"], JSON.stringify(result)).toContain(result.status);
    },
    10_000,
  );
});
