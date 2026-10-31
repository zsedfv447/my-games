# Codex Quick View Implementation Plan

**Spec:** ../specs/2026-10-31-codex-quickview.md
**Goal:** Approved unified entry and safe read-only card quick view.
**Architecture:** Shared codex tabs; isolated preview/history controller + card dialog; small UI wiring; no save/economy edits.
**Tech:** TypeScript, Vite, Vitest + existing happy-dom.

- [x] Write failing DOM/history/route integration tests, establish RED.
- [x] Implement local preview lifecycle, close/back/focus behavior; connect display card entrypoints only.
- [x] Unify navigation tabs/entry and labels; keep old routes and add archetype section targets.
- [x] Preserve acquisition and gift guards; run full suite, Pages build and diff-check.
- [x] Director review; local commit and handoff to root (no autonomous deployment).

## Verification and review

- Baseline remote main remained `184abc56bb22e3f05f4c5b89ec91d7ba3e301ae8` at the final pre-commit check.
- RED: the first five new quick-view tests failed for absent dialogs, recommended-name links and shared tabs. Added a further failing assertion to put the close control first, then implemented a sticky top close header.
- Final targeted checks: 4 files / 22 tests passed.
- Final full suite: 110 files / 1002 tests passed; Pages-base TypeScript/Vite build and `git diff --check` passed.
- Director reviewed actual code and independently passed the navigation/preview checks and Pages build. Progression reviewer independently passed 22 tests and confirmed quest fields other than display names are unchanged.
- Existing warnings: npm environment http-proxy deprecation; Vite bundle >500 kB. No test failures remain.
- Browser/Android/mobile visual checks remain unverified due to the already documented Chromium sandbox restriction; it was not retried. History, focus and Router behavior were tested with happy-dom, not a real Android device.
- Root owns publication. This branch has not been pushed or deployed by the implementation agent.
