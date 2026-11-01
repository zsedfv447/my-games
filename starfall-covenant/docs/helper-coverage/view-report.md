# Formal helper coverage — Task B UI

## Implemented / frozen
Only product `src/ui/screens/helper.ts`, new `tests/helper-support-view.test.ts` and this owner's docs/logs changed. New formal worktree only; private E29 and other product owners untouched.

常駐隊長支援 appears above unchanged NPC rotation/bond memories. Uses A's pure model: first12 rendered by default, case-insensitive name/card-ID search, clear, show-all/count, current actual slot0 leader (same activeTeam fallback as model; never promote slot1), current selection summary, original leader descriptions, model reasons/warnings and hard stage errors. No fake NPC identity or new bond promise; copy explicitly preserves card-to-NPC bond mapping. Original NPC recommendation badge now accurately says 本關推薦. New rows use a noninteractive span containing existing thumbnail children, not nested buttons.

Visible-only seen accounting queues first12/current search or expanded rows plus actually displayed NPCs. Generation, disposed, settled and connected-root checks prevent stale queued writes. This records seen only, never ownership/rewards. Search input stays mounted; filtering does not equip. Each support click re-queries current model and restrictions, and each NPC click re-queries current roster. Generation/detached/disposed/settled checks prevent replaced rows, departed screens or repeated clicks selecting/navigating. Existing chooseHelper + original prepare/back navigation remain.

## Evidence
- Initial focused before edits: four tests failed (missing12/all/search/source UI; old page had no lifecycle seen guard), `view-red.log`. The original early-leave test harness awaited async setup before leaving, so its first failure alone did not prove same-task lifecycle behavior; corrected setup explicitly invokes onLeave before the initial microtask and final case verifies that ordering.
- Intermediate model skeleton empty list: 3failed/1passed, `view-intermediate.log`; expected integration dependency, not engine defect.
- Added exact all-visible full-save check initially had expected seen-array insertion order wrong (NPCs had been seen between first12 and expanded remainder). Corrected expected from actual pre-expand baseline with real markSeen, preserving full-save equality. Brief test-edit beforeAll variable typo corrected; no product workaround.
- Final command: `node node_modules/vitest/vitest.mjs run --no-cache tests/helper-support-view.test.ts tests/helpers.test.ts` → **2 files /21 tests passed** (6 new +15 original), `view-green.log`.
- `node node_modules/typescript/bin/tsc --noEmit` → exit0, `view-typecheck.log`.

Six owned cases cover exact first12+NPC allowed seen delta, search retention/focus;91 unique expansion with complete expected save; stale search/departure/duplicate selection; synchronous leave before seen and old NPC click; newly forbidden stage rejecting prior row; selected support summary surviving zero-result filter and clearing back to12. A synthetic stage noHelper change is finally restored. Navigator callback spying is scoped DOM coverage, not a real-app claim; D independently exercises actual selection, paid ticket/resume and oath flows.

No full suite/build/Git/deployment/installation/network operation by this worker, no visual/mobile claim. Director owns final integrated verification and parent publication. All owned files now frozen.
