// Checklist 1.4.1 — Gate-2 checkout copy, exported as one versioned
// constant the same way 1.1.11 exports AssuranceLevelCopy. Each field
// carries its own version string so gate2_payments.consent_copy_version
// always stores one of these values verbatim, never hand-typed at a
// call site — the version is what turns "we showed some text" into
// evidence of exactly which text was shown, for CCR 2013 purposes.
export const Gate2ConsentCopy = {
  // Cooling-off consent checkbox — interim, counsel-pending text, sourced
  // from outstanding_issues/legal-compliance-outstanding-issues.md's L14
  // Q2 "worst-case interim posture" string (2026-07-28/08-03). A version
  // bump here is expected once counsel answers land, not optional.
  coolingOffConsent: {
    label: "I want verification to begin immediately and understand I lose any right to cancel this order",
    version: "2026-08-03-interim-v1",
  },
  // FX disclosure — already drafted and reviewed (fence-checklist-phase-0.md
  // 0.12.1, 11-lens code review, 2026-08-01). Shown as plain text near the
  // Checkout price line, not a checkbox — a disclosure, not a consent
  // action, so it never blocks progression the way the checkbox above does.
  fxDisclosure: {
    text: "This charge is billed in GBP (£). If your card was issued outside the UK, your card issuer may apply its own currency conversion and a foreign transaction fee — Fence has no visibility into or control over that fee.",
    version: "2026-08-01-v1",
  },
  // Unclaimed-payment refund-window disclosure — no prior draft exists
  // anywhere; genuinely fresh, interim, counsel-pending text, same
  // treatment as the consent string above.
  unclaimedRefundWindow: {
    text: "If you pay but don't submit verification within 90 days, your payment is automatically refunded in full.",
    version: "2026-08-17-interim-v1",
  },
} as const;
