# Task B — R18 mixed UI selective production promotion

## Completed scope
Only these four product paths changed in the production-promotion project:
- `src/ui/screens/home.ts`: disposed/onLeave guard passed to existing resume prompt.
- `src/ui/screens/settings.ts`: import dialog closed/current ownership, route close/replacement; reset tri-state confirmation, post-await current check, pending/retry. All original production import/export/reset explanations and version footer retained.
- `src/ui/components/shell.ts`: stamina-dialog identity, consume-once and route-scoped close. Original stage.append exactly retained; no badge node or overlay offset.
- `src/ui/tutorial/flow.ts`: neutral team-fit statements; original QUIET_ROUTES exactly retained, no experimental guide route.

Every input file was SHA-256 checked against immutable R18 source manifest `/tmp/experiment-r18-director-source.json` before use. Four original and resulting SHA values are in `mixed-ui-hashes.log`. Source snapshot `b2f926d0c5c838f7a0ffac14f4b2c70a4ec2f561`; production baseline `f247c1ce4b81d00bb069c681703c808d6d588127`, tree6425dc2aedd043d2f7e8fb934bf8c10e66f4dc0a. Read back full four-file diffs against original baseline: only the intended lifecycle/team wording hunks remain.

Explicit exclusions: experiment imports/notice/review CTA, badge, namespace, isolated-save prose, guide quiet-route entry. No title/index/state/save/theme/PWA/data/dependency/test files modified by this worker. No new feature or character added beyond the approved R18 promotion.

## Verification
- `./node_modules/.bin/vitest run --no-cache tests/tutorial.test.ts tests/pwa-events.test.ts` → **2 files / 38 tests passed**, exit0, `mixed-ui-focused.log`.
- First partial integration `tsc --noEmit` failed once because Task A had not yet copied battle-session's second maybeOfferResume argument. Exact diagnostic retained in `mixed-ui-typecheck-intermediate.log`. Did not alter Task A's file or loosen types.
- After Task A API landed: `./node_modules/.bin/tsc --noEmit` → exit0, `mixed-ui-typecheck.log` (empty, no diagnostics).
- An earlier focused command named nonexistent `tests/pwa.test.ts` alongside tutorial and therefore ran only25 tutorial tests; corrected immediately to the actual `pwa-events.test.ts` command above. No PWA coverage is claimed from that first run.

No new RED fabricated for a selective port of already-reviewed R18 fixes. D owns ported lifecycle/true-app regressions, C owns production compatibility assertions; director runs final full suite/build. No browser/mobile/PWA-update runtime validation claimed here. No full suite/build/Git mutation/deployment performed.

All four product files and this worker's report/logs are frozen for director review.
