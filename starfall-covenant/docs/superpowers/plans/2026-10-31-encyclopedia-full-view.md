# Full-view Encyclopedia Implementation Plan

> **For agentic workers:** Execute this bounded plan task-by-task using test-driven development.

**Goal:** Let players inspect every card for team planning without granting ownership, seen flags, rewards or achievements; audit all implemented archetypes.
**Architecture:** Remove display-only discovery gates in the existing collection screens. Keep collection/reward/save logic unchanged; use existing passiveText for awakening descriptions. Keep data-driven archetype listings and add coverage regression tests, not new archetypes.
**Tech Stack:** TypeScript, Vite, Vitest; optional Playwright against a local Vite server.
**Spec:** User explicitly authorized full-view encyclopedia plus archetype completeness check on 2026-10-31; earlier combat proposals are excluded.

## Global Constraints
- Baseline 9a171bf81dddbe1b953b38697d57a3533dae38c9; isolated codex/encyclopedia-full-view branch.
- Preserve external 15 classic cards, assistant modes, inventory, seen/owned/claimed distinction and reward eligibility.
- No main push, merge or deployment. Traditional Chinese UI copy.

## Review Focus
- Unseen cards and evolution targets reveal real names and full gameplay information.
- Grid art and accessible names stay visible regardless of discovery status.
- Browsing cannot grant collection progress, inventory or rewards.
- Every defined archetype and tagged card appears in the codex/filter; no hard-coded count limit.
- Invalid card IDs, materials, back navigation and mobile layout remain safe.

## Tasks
- [x] Add real-screen DOM regression (unseen details/grid/evolution/awakening, all archetype filters, no save writes); verify RED before UI changes. Browser blocked by sandbox, used happy-dom; no browser/visual verification claimed.
- [x] Remove discovery display gates and hidden-art CSS; retain explicit acquisition status and reward checks. Display awakening descriptions using existing formatter.
- [x] Add pure data/codex/filter/ownership tests for all archetypes; document audit matrix without altering balance or role tags.
- [x] Run full npm test (108 files / 990 tests), npm run build and git diff --check. Director review requested; browser/mobile/desktop screenshot checks blocked, documented in audit.

## Subsequent user authorization: publish and grant one named 20-gem gift

The user explicitly authorized updating the original game URL and adding a 20-gem gift after the initial local delivery. This supersedes the initial no-publication limit for this bounded change only.

- [x] Add failing gift tests before implementation; reuse lifetime quest claim persistence, no new save schema.
- [x] Add `a-codex-opening` achievement and a visible collection-page claim panel (20 gems); preserve other achievements and card ownership.
- [x] Full suite (109 files / 993 tests), Pages-base build and director review passed; refreshed main still matches baseline.
- [ ] Publish without force-push; verify exact remote commit, CI/deploy success, and live content hashes.
