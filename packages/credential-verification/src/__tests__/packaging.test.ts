import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Regression test for a real bug found 2026-08-22 while migrating
// verification's own consumption of this package: src/index.ts and
// status-list-client.ts's relative imports omitted the `.js` extension.
// TypeScript's `Bundler` moduleResolution (this monorepo's shared
// tsconfig.base.json) accepts an extensionless relative specifier at
// typecheck time and preserves it verbatim in the emitted JS — but this
// package's package.json declares "type": "module", so Node's own ESM
// resolver (the one that actually runs at a real consumer's install, not
// TypeScript's) requires an explicit extension on every relative import.
// A genuinely fresh `npm install` of the published package throws
// `Cannot find module '.../dist/passport-signature-verification' imported
// from '.../dist/index.js'` the first time anything imports it. The
// source-level unit tests import from `../status-list-client` directly
// and never exercise the compiled dist/ output under Node's real
// resolver — and a workspace-symlinked self-import inside this same
// monorepo doesn't reproduce it either, since Vitest's resolver is more
// lenient than Node's for anything outside a real node_modules download
// — so this broke silently past 100% coverage and a green CI run.
// Asserting directly on the compiled output's own import specifiers is
// what actually catches it.
const distDir = fileURLToPath(new URL("../../dist", import.meta.url));

describe("the published dist/ build", () => {
  it.each(["index.js", "status-list-client.js"])("%s's relative imports all carry an explicit .js extension", (file) => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed dist dir + one of this test's own two literal filenames, not user input
    const contents = readFileSync(path.join(distDir, file), "utf8");
    const relativeSpecifiers = [...contents.matchAll(/from ["'](\.[^"']+)["']/g)].map((match) => match[1]);
    expect(relativeSpecifiers.length).toBeGreaterThan(0);
    for (const specifier of relativeSpecifiers) {
      expect(specifier).toMatch(/\.js$/);
    }
  });
});
