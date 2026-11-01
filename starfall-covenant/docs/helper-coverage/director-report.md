# Formal helper coverage — director approval for publication

## Authority and purpose
User explicitly requested all appropriate existing leader helpers without needing real friends, priority based on the current leader, and direct formal publication when complete. Parent verified current formal main 5929d1ff340ebf0c5669aa2e4f22815163207916. This isolated branch implements ONLY that request. Private recap, prototype, artwork and experiment storage are NOT promoted.

## Delivered behavior
- All 91 non-material cards with valid current leader definitions are selectable permanent support, without ownership or friend prerequisites. Existing 15 NPCs cover only 38 distinct historical tier cards; 53 were previously never offered. Earlier tiers also disappeared when replaced. New catalog keeps every valid alternative.
- First 12 relevant results, name/card-ID search, clear and show-all. Current selection remains visible; searching/sorting does not equip anyone. The actual slot0 leader is used, never a later member promoted across a missing slot.
- Reference ordering uses same card/leader skill, actual condition/effect types, typed attack targets and known whole-team conditions. Hard stage restrictions and known conflicts sort ahead of same-card preference as specified. Original leader text and warnings stay visible. Dynamic HP/Combo/matches are not simulated or declared active; this is not an optimal-team or damage guarantee.
- Original NPC roster, daily rotation, progression-scaled helper/skill levels, explicit no-helper selection and NPC tier refresh remain. A manually selected permanent helper survives preparation refresh and enters the existing paid ticket/snapshot path.
- Borrowed teams, stage restrictions and noHelper oath remain enforced. Clearing the oath restores the remembered choice; paid ticket reload uses its saved helper and does not charge stamina again.
- Only actual rendered support rows plus NPC rows become historically seen, not all91 on entry; no ownership, cards or rewards are granted. Existing card-ID based NPC bond settlement is unchanged and accurately explained, not silently disabled or extended with a new source schema.

## Exact product boundary
New src/ui/helper-support.ts; changed src/ui/screens/helper.ts, src/ui/screens/prepare.ts, src/ui/sortie.ts. No card/skill/data/engine/save/reward/bond implementation changes. No CSS/route/asset/dependency/workflow/PWA/hosting changes. All 456 original assets remain exact; 473 protected formal files match baseline pins. All data files match base5929 byte-for-byte; cards remain112. No private experimental runtime files/imports are introduced.

Independent ideation reviewer read the final four product files and four reports, found no concrete blocker, and specifically checked same-card versus composition conflict, no old-helper contamination of candidate composition, selection preservation, visible-only seen updates and truthful bond semantics.

## Verification
A: new model6 + original helpers15/bond7 =28 passed; typecheck0. B: own UI6 + original helpers15 =21 passed; typecheck0. C: independent actual-data/engine12 passed; typecheck0. D: own true-app5 + original E20 selection3/oath2/resume2 =12 passed; typecheck0. Missing model/interface and UI RED evidence preserved; actual pre-existing engine behavior was not called an engine defect.

Director initial full serial62786 ended1:195 files/1498 tests passed, two old E17 navigation cases failed solely because their returning-player fixture premarked old NPC cards but not the new actual visible catalog page. An independent E16 navigation run confirmed the same two failures. D amended only already-seen setup with exact first12 IDs for that fixture/stage, retaining all NPC tiers; no test body/full-save/raw/zero-write/stale assertions changed. E17 9/9 and E16 navigation8/8 then passed. Logs and rationale remain in app-report.md. Existing E20 fixtures similarly assert exact legitimately rendered seen deltas instead of ignoring collection or arbitrary writes.

Final director serial31679 completed exit0 on2026-11-01 05:19 UTC:
- **196 files / 1500 default tests passed**.
- **E13 57 and E16 27 audit tests passed**.
- Project and both audit TypeScript checks exit0.
- Production build with PAGES_BASE=/my-games/starfall-covenant/ exit0, including original PWA plugin/service worker.
- Independent approved-path/protected-file/data/assets/production-boundary gate exit0.
- git diff --check exit0.
Installed local node binaries only, no npx, dependency installation, registry bypass or publication command. Logs /tmp/helper-production-final-*.log. Initial failed log /tmp/helper-production-director-tests.log preserved.

## Compiled identity and handoff
Gate /tmp/helper-production-director-manifest.json; read-only verifier /tmp/verify-helper-production.py.
Compact dist manifest SHA256 d58bc38331532ff578e436c05d3a22ba9493029dbf872138806f5bc6246712bf.
- assets/index-BUsqW9e-.js:903410bytes SHA213d27cd33652a7d3a8018def5898dbcd1dcd43073e68039a7ba3818e69757f6.
- index.html:1627bytes SHA045db152527d37e7cca47b32ad85b92651553805b16e1f09f7ba86044016f74a.
- sw.js:14786bytes SHA969d93f4b0a978b8980fc3de31bedd59779092d8ddcb59bad98e52bf7e8861ed.
- manifest.webmanifest SHA254cb479cdb6eed46d9d02c50a5144fa5564f1feab32bd55e30ce819482e1d50.

All workers and director source writing stop after this report/plan and source manifest. Parent independently authenticates the trusted source manifest, base main, exact tree and compiled output, then performs the explicitly authorized formal publication and live verification. No claim of published status before those external steps.

## Evidence limits
Real-app tests use isolated synthetic save fixtures and drawing stubs, not phone/browser visual QA or real player saves. A synthetic fire-only stage rule is disclosed and restored after its test; the actual fixed-team trial and noHelper oath are tested separately. Seen status does not mean current ownership. Always-available leader choices intentionally broaden borrowing, but do not establish every possible team as balanced or every dynamic skill condition as satisfied. No new card or effect is invented.
