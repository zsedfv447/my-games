# R18 promotion C: production save and boundary compatibility

## Status
**5 files /45 tests PASS; typecheck exit0.** Independent tests/fixtures/report only; no product, schema, engine, deployment, Git or dependency changes. All owned writes frozen after this report.

## Baselines and fixtures
Production f247c1ce4b81d00bb069c681703c808d6d588127 tree6425dc2aedd043d2f7e8fb934bf8c10e66f4dc0a equals original204cbc3 tree. Previous read-only review directly compared relevant files in new production worktree to original. The fixture generator imported **untouched original** `encyclopedia-work/starfall-covenant` modules, not candidate modules, and wrote only owned synthetic fixture path. No user storage read.

`tests/fixtures/promotion/legacy-v4.json` contains synthetic raw envelope and original plain-base64 export produced by baseline APIs. Fixed clock2026-11-01T03:00:00Z; real starter roster/UIDs, name 合成舊版備份測試, coin12345/gems37, bgm0.3, opening gift marked claimed, first starter collection reward claimed. Existing `enterStage` actually deducts st-1-1 stamina; real seeded battle31337 takes one empty move then actual beginActiveBattle/recordBattleSnapshot persist the snapshot. This is a legal paid-entry snapshot, not a mock ticket or hand-played browser session. No enemy/card/snapshot statistics manually changed. Empty planned drops are explicit valid fixture. It is **not** a newly claimed paid-revive test; detailed Continue/settlement safety comes from separately ported regressions.

Fixture SHA256:
- legacy-v4.json: `90e5edd7df413d43754c9c7ee54b7b8ad49959a4592a292fdf818f913e9677ea`
- protected-baseline.json: `1ee5386176a41adb603f643cfbd958532d211b5797d16f7ea9bad8974e3ea6cb`

Pinned baseline inventory is473 files:456 actual assets and17 protected files (save/parser/state, assistant preferences, debug stage lookup, active-battle schema, main/PWA sources/plugin, Vite config, manifest/index/package/lock/config and original save.test). Hashes came from original baseline, not current candidate after selection.

## New contracts
`promotion-save-compat.test.ts` (happy-dom, real modules):
1. Original raw and whitespace-surrounded backup load exact complete expected SaveData; serializer/export byte-identical to original fixture; exact formal key/version4; tagged experiment backup rejected by original parser, no new parser rule.
2. Actual production state boots old raw; reads original UI prefs and Greek assistant mode. Actual openStageBattle called twice returns resumed true and full exact baseline snapshot including RNG and planned drops. Full save/stamina/raw unchanged and **zero storage writes** during reopen. Already-paid entry not charged again. No Router/UI substitution or engine mocks.
3. Corrupt checksum raw survives settings volume commit, invalid code, and tagged experiment code while loadProblem remains checksum. Original valid backup clears problem, restores full progress/export, then module reload retains exact recovered raw with no warning. Fake experimental sentinel keys remain byte-identical in localStorage and sessionStorage throughout all cases.

Synthetic sentinels use experimental prefix plus save/prefs/assistant/probe/debug keys, never real environment data. Fixed time prevents stamina regeneration noise. No safety comparison drops collection/reward flags/resources or active ticket.

`promotion-boundary.test.ts`:
- Every473 protected byte hash exact, assets set exactly456 with no extra/missing files.
- No src/experiment.ts or experiment-review file; recursively no namespace/export-prefix/guide/badge/EXPERIMENT_NOTICE/LABEL/experimentKey runtime coupling.
- Actual production pwaPlugin and serviceWorker.register code present; no dist dependency. Director separately validates emitted Pages-base worker and URLs.

## Existing contracts retained / verification
Unchanged original save.test includes historical version2/version3 migration and errors; active-battle and PWA events retained. Command:

`./node_modules/.bin/vitest run --no-cache tests/promotion-save-compat.test.ts tests/promotion-boundary.test.ts tests/save.test.ts tests/active-battle.test.ts tests/pwa-events.test.ts`

First run **45/45green** (5 new +19 original save +8 active-battle +13 PWA), log clock11:57:11, `docs/promotion/save-compat-initial.log`. Existing behavior first-green is expected, no fabricated RED. `./node_modules/.bin/tsc --noEmit` exit0, empty `save-compat-typecheck.log`.

## Limits
These tests do not establish real browser offline/cache update, actual public-host storage origin, mobile touch, real-user save migration, or full publication success. No build/full suite/Git/deploy by this writer. No actual user save used. Hash pins intentionally stop later edits to protected files; intentional future updates need a separately reviewed baseline, not silent regenerated hashes. Director owns final integrated review/build and parent publication authority.
