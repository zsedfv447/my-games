# R18 Production Promotion Plan

> **For agentic workers:** Use subagent-driven-development or executing-plans, preserve the spec and owned paths.
**Goal:** Selectively promote approved R18 improvements without losing formal saves or PWA.
**Architecture:**35 clean UI source files and3 description-data files; four mixed-hunk files; independent compatibility and selectively ported tests.
**Spec:** docs/promotion/r18-spec.md

## A — clean product/data selection (build_e00)
Own35 files listed in r18-ui-review.md and data/archetypes.json,skills.json,leader-skills.json. No other products/tests/tools.
- Verify source each SHA against immutable R18 manifest.
- Verify currentmain baseline equals original baseline for each modified existing file; copy only approved paths, no directories.
- Data allow exactly18 previously reviewed strings using immutable experiment gate tuple list, preserve all other bytes. Record exact old/new list/hashes in report.
- Typecheck may wait mixed owners. Report manifest and freeze. No Git/build/full/deploy.

## B — mixed production UI (prepare_approved_implementation)
Own src/ui/screens/home.ts,settings.ts; components/shell.ts; tutorial/flow.ts ONLY.
- Apply lifecycle/team wording changes with original production texts/quiet list/constructor and no guide/badge/import.
- No title/index/state/save/theme modification. Review source against both baseline and R18.
- Typecheck plus existing tutorial/settings/PWA relevant tests, report/freeze. Don't change other worker tests.

## C — independent preservation/compatibility (review_original_fidelity)
Own new tests/promotion-save-compat.test.ts, tests/promotion-boundary.test.ts and synthetic fixtures under tests/fixtures/promotion/, docs/promotion/save-compat-* only. No product files.
- Capture baseline-generated synthetic raw/export fixture before source selection where possible; not real user data. Verify oldparser/newruntime backward compatibility, exact production keys and experiment sentinels untouched, valid activeBattle resume/snapshot/no-recharge.
- Preserve originalsave.test historical versions; test production import recovery/legacy raw acceptance, invalid experiment-code rejection without modifying parser.
- Assert baseline hashes for protected storage/PWA/manifest/config/assets files and absent experimental runtime dependencies. Tests run without requiring built dist; director separately verifies actual Pages SW build.
- Focused/typecheck, exact findings/report/freeze. No engine/product fix without director approval.

## D — selected regression port (research_original_progression)
Own existing tests/ allowed additions/edits and audit/e13,e16 + configs, except C's new promotion-* and fixtures. No products.
- Follow your reviewed explicit test manifest, exclude experiment-only E00/isolation/guide/data-release/sourceCLI/imagebudget tests/tools, retain original save.test.ts unchanged.
- Port behavioral feature/safety tests and adjust only namespace/sentinel harness, preserving assertions. Handle legacy additive acquire kind expected assertion.
- Report every adaptation and any underlying regression separately. Focused batches/typecheck only, director full once all writers frozen.

Director owns docs/promotion manifests/review and final serial integration, not worker files. Root alone commit/push/deploy. No future creative proposal or new card included.
