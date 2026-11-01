# Greek leader stacking Implementation Plan

> Agentic workers use subagent-driven-development/executing-plans within assigned ownership; parent alone commits/publishes.

**Goal:** Dual Greek leader forced-enhanced-orb contributions add while existing safety/persistence remains.
**Architecture:** Change only per-color aggregation in board resolution; static leader evaluation already supplies both effects. Five descriptions reflect the corrected stacking. Independent actual-engine and resume tests verify it.
**Tech Stack:** Existing TypeScript/Vitest/local installed tools.
**Spec:** docs/greek-stacking/spec.md

## Constraints / review focus
- Same-color duplicates add, mixedcolor separate, total never exceeds free slots (A/C).
- Invalid/overflow settings cannot introduce nonfinite loops or allocation; existing50cap/noSkyfall remain (A).
- Single/noeffect path and RNG remain compatible; sealedorbs never count as matched (A/D).
- Actual current fivecards attack multiplier and active mark behavior unchanged (B/C).
- JSONsave/resume/schema/PWA/asset/data boundary unchanged except exact5copy (B/D/director).

### A runtime — build_e00
Own src/battle/board.ts, src/battle/leader.ts comment only, tests/greek-mechanics.test.ts matching oldcase only, newtests/greek-stacking-board.test.ts, runtime report/logs.
- [ ] Update old nonstack expectations and new sum tests first, run effective RED.
- [ ] Implement bounded sum of valid each-effect contribution, unchanged slot/cascade/drop logic. No spread max or global changes.
- [ ] Focused board/Greek/localtsc, reportfreeze. No full/build.

### B copy/UI — prepare_approved_implementation
Own data/leader-skills.json five exactdescription replacements only, newtests/greek-stacking-copy.test.ts and own report/log.
- [ ] RED new exactcopy/unchanged-rules contracts and actual card detail/help reading.
- [ ] Only five literal replacements; source JSON formatting preserved.
- [ ] Verify all other data bytes/leader effects and guide-independent formalUI read/save behavior; focused/localtsc/reportfreeze.

### C true engine — review_original_fidelity
Own newtests/greek-stacking-engine.test.ts +report/log, no product/oldtest changes.
- [ ] Actual l806–810 cards single/double use real start/resume/submit fixed board, firststep forcedenhanced count1vs2 for3 and2vs4 for6; staticarraylength1vs2; trueATK2.5vs6.25 unchanged.
- [ ] Independent mixedcolor/helper/active-mark control; assert mechanism actually occurred, not empty loop.
- [ ] Focused+existingGreek tests afterA ready/localtsc/reportfreeze, truthful firstgreen iflanded.

### D persistence/boundary — research_original_progression
Own newtests/greek-stacking-resume.test.ts +report/log only.
- [ ] Actual dualGreek JSONcheckpoint then live-vs-resumed same fixed legal suffix fullsnapshot/RNG/action/result/events exact; require real forcedenhancedstep and RNG advance. Startup events separate, no normalization hiding differences.
- [ ] Run unchanged originalsave/activebattle/promotioncompat/PWA tests appropriate existingfilenames; no fixtures or product edits withoutapproval.
- [ ] Report formalstorage/backup/PWA and same-version resume evidence limitations; localtsc/freeze, no full/build.

Director reads all diffs, exact data reconstruction and protected baseline hashes; runs full default+fixed57/27audits+3tsc/Pagesbuild/customreadonlypathgate. Final report/source manifest thenfreeze; parent publication only. No privateworkspace edits.
